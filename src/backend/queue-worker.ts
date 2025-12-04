// =====================================================
// QUEUE WORKER - Background Message Queue Processor
// =====================================================

import { query, queryOne, update, closePool } from "./lib/db"
import type { ScheduledMessage, WhatsAppSession, Tenant } from "./lib/types"

interface QueueConfig {
  batchSize: number
  intervalMs: number
  maxRetries: number
}

const DEFAULT_CONFIG: QueueConfig = {
  batchSize: parseInt(process.env.QUEUE_BATCH_SIZE || "10", 10),
  intervalMs: parseInt(process.env.QUEUE_INTERVAL_MS || "5000", 10),
  maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || "3", 10),
}

const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL || "http://localhost:3001"

let isRunning = true
let processedCount = 0
let failedCount = 0

// =====================================================
// MESSAGE PROCESSING
// =====================================================

interface SendMessageResponse {
  success: boolean
  data?: { messageId?: string }
  error?: string
}

async function sendMessageViaServer(
  tenantId: string,
  to: string,
  content: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(`${WHATSAPP_SERVER_URL}/api/whatsapp/send/${tenantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, content, mediaUrl }),
    })

    const data = (await response.json()) as SendMessageResponse
    return {
      success: data.success,
      messageId: data.data?.messageId,
      error: data.error,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Verify order/payment status before sending reminder-type messages
async function shouldSendMessage(message: ScheduledMessage): Promise<boolean> {
  try {
    // If linked to an order, re-check status to avoid sending after payment/refund/cancel
    if (message.order_id) {
      const order = await query<{ status: string }>(
        `SELECT status FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [message.order_id, message.tenant_id]
      )
      const status = order[0]?.status
      if (status && ["paid", "refunded", "cancelled"].includes(status)) {
        return false
      }
    }
  } catch (e) {
    console.warn("[Queue Worker] Failed to check order status, proceeding:", e)
  }
  return true
}

async function processMessage(message: ScheduledMessage): Promise<void> {
  try {
    console.log(`[Queue Worker] Processing message ${message.id} for ${message.phone}`)

    // Skip if order is no longer pending
    const okToSend = await shouldSendMessage(message)
    if (!okToSend) {
      await update("scheduled_messages", message.id, {
        status: "cancelled",
        last_attempt: new Date().toISOString(),
        error_message: "Skipped: order no longer pending",
      })
      await logMessage(message, "failed", "Skipped: order no longer pending")
      console.log(`[Queue Worker] Message ${message.id} skipped: order not pending`)
      return
    }

    // Mark as processing
    await update("scheduled_messages", message.id, {
      status: "processing",
      last_attempt: new Date().toISOString(),
    })

    // Send the message via WhatsApp server
    const result = await sendMessageViaServer(
      message.tenant_id,
      message.phone,
      message.message_content
    )

    if (result.success) {
      // Success - update status
      await update("scheduled_messages", message.id, {
        status: "sent",
        attempts: message.attempts + 1,
      })

      // Log the message
      await logMessage(message, "sent")
      processedCount++

      console.log(`[Queue Worker] Message ${message.id} sent successfully`)
    } else {
      // Failure - increment attempts
      const newAttempts = message.attempts + 1
      await update("scheduled_messages", message.id, {
        status: newAttempts >= DEFAULT_CONFIG.maxRetries ? "failed" : "pending",
        attempts: newAttempts,
        error_message: result.error,
      })

      if (newAttempts >= DEFAULT_CONFIG.maxRetries) {
        await logMessage(message, "failed", result.error)
        failedCount++
      }

      console.log(`[Queue Worker] Message ${message.id} failed: ${result.error}`)
    }
  } catch (error) {
    console.error(`[Queue Worker] Error processing message ${message.id}:`, error)

    await update("scheduled_messages", message.id, {
      status: "pending",
      attempts: message.attempts + 1,
      error_message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

async function logMessage(
  message: ScheduledMessage,
  status: "sent" | "failed",
  errorMessage?: string
): Promise<void> {
  await query(
    `INSERT INTO message_logs (tenant_id, customer_id, order_id, flow_id, phone, message_content, status, sent_at, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      message.tenant_id,
      message.customer_id,
      message.order_id,
      message.flow_id,
      message.phone,
      message.message_content,
      status,
      status === "sent" ? new Date().toISOString() : null,
      errorMessage,
      JSON.stringify({}),
    ]
  )
}

// =====================================================
// BATCH PROCESSING
// =====================================================

async function processNextBatch(): Promise<void> {
  try {
    // Get active tenants with connected WhatsApp sessions
    const activeTenants = await query<{ tenant_id: string }>(
      `SELECT DISTINCT tenant_id FROM whatsapp_sessions WHERE status = 'connected'`
    )

    if (activeTenants.length === 0) {
      return
    }

    const tenantIds = activeTenants.map((t) => t.tenant_id)

    // Fetch pending messages for active tenants
    const messages = await query<ScheduledMessage>(
      `SELECT * FROM scheduled_messages 
       WHERE tenant_id = ANY($1)
       AND status = 'pending' 
       AND scheduled_for <= NOW()
       AND attempts < $2
       ORDER BY scheduled_for
       LIMIT $3`,
      [tenantIds, DEFAULT_CONFIG.maxRetries, DEFAULT_CONFIG.batchSize]
    )

    if (messages.length === 0) {
      return
    }

    console.log(`[Queue Worker] Processing batch of ${messages.length} messages`)

    for (const message of messages) {
      if (!isRunning) break
      await processMessage(message)
      // Delay between messages to avoid rate limiting
      await delay(1000 + Math.random() * 2000)
    }
  } catch (error) {
    console.error("[Queue Worker] Error processing batch:", error)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// =====================================================
// CLEANUP TASKS
// =====================================================

async function cleanupOldMessages(): Promise<void> {
  try {
    // Delete messages older than 30 days that are sent or cancelled
    const result = await query(
      `DELETE FROM scheduled_messages 
       WHERE status IN ('sent', 'cancelled') 
       AND created_at < NOW() - INTERVAL '30 days'
       RETURNING id`
    )

    if (result.length > 0) {
      console.log(`[Queue Worker] Cleaned up ${result.length} old messages`)
    }
  } catch (error) {
    console.error("[Queue Worker] Error cleaning up old messages:", error)
  }
}

async function resetStuckMessages(): Promise<void> {
  try {
    // Reset messages that have been stuck in "processing" for more than 5 minutes
    const result = await query(
      `UPDATE scheduled_messages 
       SET status = 'pending'
       WHERE status = 'processing' 
       AND last_attempt < NOW() - INTERVAL '5 minutes'
       RETURNING id`
    )

    if (result.length > 0) {
      console.log(`[Queue Worker] Reset ${result.length} stuck messages`)
    }
  } catch (error) {
    console.error("[Queue Worker] Error resetting stuck messages:", error)
  }
}

// =====================================================
// MAIN LOOP
// =====================================================

async function runWorker(): Promise<void> {
  console.log("[Queue Worker] Starting...")
  console.log(`[Queue Worker] Config: batchSize=${DEFAULT_CONFIG.batchSize}, interval=${DEFAULT_CONFIG.intervalMs}ms, maxRetries=${DEFAULT_CONFIG.maxRetries}`)
  console.log(`[Queue Worker] WhatsApp Server URL: ${WHATSAPP_SERVER_URL}`)

  let cleanupCounter = 0

  while (isRunning) {
    try {
      await processNextBatch()

      // Run cleanup every 100 iterations (about every 8 minutes with 5s interval)
      cleanupCounter++
      if (cleanupCounter >= 100) {
        await cleanupOldMessages()
        await resetStuckMessages()
        cleanupCounter = 0
      }
    } catch (error) {
      console.error("[Queue Worker] Error in main loop:", error)
    }

    await delay(DEFAULT_CONFIG.intervalMs)
  }

  console.log("[Queue Worker] Stopped")
}

// =====================================================
// STATS ENDPOINT (Simple HTTP server for health checks)
// =====================================================

import http from "http"

const STATS_PORT = process.env.QUEUE_STATS_PORT || 3002

const statsServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        status: "healthy",
        running: isRunning,
        processed: processedCount,
        failed: failedCount,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      })
    )
  } else if (req.url === "/stats") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        processed: processedCount,
        failed: failedCount,
        config: DEFAULT_CONFIG,
        uptime: process.uptime(),
      })
    )
  } else {
    res.writeHead(404)
    res.end("Not found")
  }
})

statsServer.listen(STATS_PORT, () => {
  console.log(`[Queue Worker] Stats server running on port ${STATS_PORT}`)
})

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function shutdown(): Promise<void> {
  console.log("[Queue Worker] Shutting down gracefully...")
  isRunning = false

  // Give time for current processing to complete
  await delay(2000)

  statsServer.close()
  await closePool()

  console.log(`[Queue Worker] Final stats: processed=${processedCount}, failed=${failedCount}`)
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

// Start the worker
runWorker().catch((error) => {
  console.error("[Queue Worker] Fatal error:", error)
  process.exit(1)
})
