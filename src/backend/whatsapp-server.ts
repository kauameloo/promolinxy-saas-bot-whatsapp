// =====================================================
// WHATSAPP SERVER - Backend WhatsApp Engine Service
// =====================================================

import { WhatsAppEngine, whatsappManager } from "./lib/whatsapp-engine"
import { MessageQueue } from "./lib/message-queue"
import { query, queryOne, update, dbPool, closePool } from "./lib/db"
import type { WhatsAppSession, Tenant } from "./lib/types"
import express, { Application, Request, Response, NextFunction } from "express"
import cors from "cors"
import { handleTypeBotMessage, initializeTypeBotBridge, removeTypeBotBridge } from "./lib/typebot-service"
import { sendTypeBotMessages } from "./lib/typebot-sender"

const app: Application = express()
const PORT = process.env.WHATSAPP_PORT || 3001
const HOST = process.env.WHATSAPP_HOST || "0.0.0.0"

// Middleware
app.use(cors())
app.use(express.json())

// Store active queues
const activeQueues: Map<string, MessageQueue> = new Map()

// =====================================================
// API ROUTES
// =====================================================

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Get WhatsApp status for a tenant
app.get("/api/whatsapp/status/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params

    const session = await queryOne<WhatsAppSession>(
      `SELECT * FROM whatsapp_sessions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    )

    if (!session) {
      return res.json({
        success: true,
        data: {
          id: "",
          tenant_id: tenantId,
          session_name: "principal",
          status: "disconnected",
          created_at: new Date(),
          updated_at: new Date(),
        },
      })
    }

    return res.json({
      success: true,
      data: session,
    })
  } catch (error) {
    console.error("WhatsApp status error:", error)
    return res.status(500).json({ success: false, error: "Error fetching status" })
  }
})

// Connect WhatsApp session
app.post("/api/whatsapp/connect/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params

    // Check if tenant exists
    const tenant = await queryOne<Tenant>(
      `SELECT * FROM tenants WHERE id = $1`,
      [tenantId]
    )

    if (!tenant) {
      return res.status(404).json({ success: false, error: "Tenant not found" })
    }

    // Get or create session
    let session = await queryOne<WhatsAppSession>(
      `SELECT * FROM whatsapp_sessions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    )

    if (!session) {
      // Create new session
      const result = await query<WhatsAppSession>(
        `INSERT INTO whatsapp_sessions (tenant_id, session_name, status)
         VALUES ($1, 'principal', 'connecting')
         RETURNING *`,
        [tenantId]
      )
      session = result[0]
    } else {
      // Update existing session
      session = await update<WhatsAppSession>("whatsapp_sessions", session.id, {
        status: "connecting",
        updated_at: new Date().toISOString(),
      })
    }

    // Initialize WhatsApp engine
    const engine = await whatsappManager.createEngine(tenantId, {
      onQRCode: async (qr: string) => {
        await update("whatsapp_sessions", session!.id, {
          status: "qr_ready",
          qr_code: qr,
          updated_at: new Date().toISOString(),
        })
        console.log(`[WhatsApp ${tenantId}] QR Code generated`)
      },
      onReady: async (phoneNumber: string) => {
        await update("whatsapp_sessions", session!.id, {
          status: "connected",
          phone_number: phoneNumber || null,
          qr_code: null,
          last_connected: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        console.log(`[WhatsApp ${tenantId}] Connected: ${phoneNumber}`)

  // Start message queue for this tenant
  // Option A: Disable internal MessageQueue to avoid duplicate processing.
  // The standalone queue-worker is responsible for scheduling.
  console.log(`[Queue] Internal MessageQueue disabled. Standalone worker will process tenant ${tenantId}`)
      },
      onDisconnected: async (reason: string) => {
        await update("whatsapp_sessions", session!.id, {
          status: "disconnected",
          updated_at: new Date().toISOString(),
        })
        console.log(`[WhatsApp ${tenantId}] Disconnected: ${reason}`)

        // Stop message queue
        stopMessageQueue(tenantId)
        
        // Remove TypeBot bridge
        removeTypeBotBridge(tenantId)
      },
      onMessage: async (message) => {
        console.log(`[WhatsApp ${tenantId}] Incoming message from ${message.from}: ${message.body}`)
        
        // Try TypeBot bridge integration
        try {
          const outbound = await handleTypeBotMessage(tenantId, message.from, message.body, "text")
          if (outbound && outbound.messages.length > 0) {
            // Send TypeBot response back to WhatsApp
            await sendTypeBotMessages(engine, outbound.to, outbound.messages, outbound.delay)
            console.log(`[WhatsApp ${tenantId}] Sent ${outbound.messages.length} TypeBot responses`)
          }
        } catch (error) {
          console.error(`[WhatsApp ${tenantId}] TypeBot error:`, error)
        }
      },
    })

    await engine.initialize()

    return res.json({
      success: true,
      message: "Connection initiated. Waiting for QR Code.",
      data: { sessionId: session?.id },
    })
  } catch (error) {
    console.error("WhatsApp connect error:", error)
    return res.status(500).json({ success: false, error: "Error connecting" })
  }
})

// Disconnect WhatsApp session
app.post("/api/whatsapp/disconnect/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params
    // Allow preserving session data for future restoration (default: false = full logout)
    const { preserveSession } = req.body as { preserveSession?: boolean }

    await whatsappManager.removeEngine(tenantId, preserveSession)
    stopMessageQueue(tenantId)

    const session = await queryOne<WhatsAppSession>(
      `SELECT * FROM whatsapp_sessions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    )

    if (session) {
      await update("whatsapp_sessions", session.id, {
        status: "disconnected",
        qr_code: null,
        updated_at: new Date().toISOString(),
      })
    }

    return res.json({ 
      success: true, 
      message: preserveSession 
        ? "Disconnected. Session data preserved for future reconnection." 
        : "Disconnected and logged out completely."
    })
  } catch (error) {
    console.error("WhatsApp disconnect error:", error)
    return res.status(500).json({ success: false, error: "Error disconnecting" })
  }
})

// Send message
app.post("/api/whatsapp/send/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params
    const { to, content, mediaUrl } = req.body

    if (!to || !content) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: to, content",
      })
    }

    const engine = whatsappManager.getEngine(tenantId)

    if (!engine) {
      return res.status(400).json({
        success: false,
        error: "WhatsApp session not initialized",
      })
    }

    if (!engine.isConnected()) {
      return res.status(400).json({
        success: false,
        error: "WhatsApp not connected",
      })
    }

    const result = mediaUrl
      ? await engine.sendMediaMessage({ to, content, mediaUrl })
      : await engine.sendMessage({ to, content })

    if (result.success) {
      return res.json({
        success: true,
        data: { messageId: result.messageId },
      })
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
      })
    }
  } catch (error) {
    console.error("Send message error:", error)
    return res.status(500).json({ success: false, error: "Error sending message" })
  }
})

// Get all sessions status
app.get("/api/whatsapp/sessions", (_req: Request, res: Response) => {
  const sessions = whatsappManager.getAllSessions()
  return res.json({ success: true, data: sessions })
})

// =====================================================
// TYPEBOT BRIDGE API ROUTES
// =====================================================

// Get TypeBot flows for a tenant
app.get("/api/typebot/flows/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params

    const flows = await query(
      `SELECT id, tenant_id, name, flow_url, is_active, settings, created_at, updated_at
       FROM typebot_flows 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    )

    return res.json({ success: true, data: flows })
  } catch (error) {
    console.error("Get TypeBot flows error:", error)
    return res.status(500).json({ success: false, error: "Error fetching flows" })
  }
})

// Create TypeBot flow
app.post("/api/typebot/flows/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params
    const { name, flowUrl, token, settings } = req.body

    if (!name || !flowUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, flowUrl",
      })
    }

    const result = await query(
      `INSERT INTO typebot_flows (tenant_id, name, flow_url, token, settings, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [tenantId, name, flowUrl, token || null, JSON.stringify(settings || {})]
    )

    // Initialize bridge for this tenant
    await initializeTypeBotBridge(tenantId)

    return res.json({ success: true, data: result[0] })
  } catch (error) {
    console.error("Create TypeBot flow error:", error)
    return res.status(500).json({ success: false, error: "Error creating flow" })
  }
})

// Update TypeBot flow
app.put("/api/typebot/flows/:tenantId/:flowId", async (req: Request, res: Response) => {
  try {
    const { tenantId, flowId } = req.params
    const { name, flowUrl, token, settings, isActive } = req.body

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (flowUrl !== undefined) {
      updates.push(`flow_url = $${paramIndex++}`)
      values.push(flowUrl)
    }
    if (token !== undefined) {
      updates.push(`token = $${paramIndex++}`)
      values.push(token)
    }
    if (settings !== undefined) {
      updates.push(`settings = $${paramIndex++}`)
      values.push(JSON.stringify(settings))
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(isActive)
    }

    updates.push(`updated_at = NOW()`)

    values.push(flowId)
    values.push(tenantId)

    const result = await query(
      `UPDATE typebot_flows 
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
       RETURNING *`,
      values
    )

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: "Flow not found" })
    }

    // Reinitialize bridge with new config
    await initializeTypeBotBridge(tenantId)

    return res.json({ success: true, data: result[0] })
  } catch (error) {
    console.error("Update TypeBot flow error:", error)
    return res.status(500).json({ success: false, error: "Error updating flow" })
  }
})

// Delete TypeBot flow
app.delete("/api/typebot/flows/:tenantId/:flowId", async (req: Request, res: Response) => {
  try {
    const { tenantId, flowId } = req.params

    await query(
      `DELETE FROM typebot_flows WHERE id = $1 AND tenant_id = $2`,
      [flowId, tenantId]
    )

    // Remove bridge if no more active flows
    const remainingFlows = await query(
      `SELECT id FROM typebot_flows WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
      [tenantId]
    )

    if (remainingFlows.length === 0) {
      removeTypeBotBridge(tenantId)
    }

    return res.json({ success: true, message: "Flow deleted" })
  } catch (error) {
    console.error("Delete TypeBot flow error:", error)
    return res.status(500).json({ success: false, error: "Error deleting flow" })
  }
})

// Get TypeBot logs for a tenant
app.get("/api/typebot/logs/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params
    const { phone, sessionId, limit = "100" } = req.query

    let queryStr = `
      SELECT id, phone, session_id, direction, content, message_type, error_message, created_at
      FROM typebot_logs 
      WHERE tenant_id = $1
    `
    const params: unknown[] = [tenantId]
    let paramIndex = 2

    if (phone) {
      queryStr += ` AND phone = $${paramIndex++}`
      params.push(phone)
    }

    if (sessionId) {
      queryStr += ` AND session_id = $${paramIndex++}`
      params.push(sessionId)
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`
    params.push(parseInt(limit as string, 10))

    const logs = await query(queryStr, params)

    // Mask phone numbers in response
    const maskedLogs = logs.map((log: any) => ({
      ...log,
      phone: maskPhone(log.phone),
    }))

    return res.json({ success: true, data: maskedLogs })
  } catch (error) {
    console.error("Get TypeBot logs error:", error)
    return res.status(500).json({ success: false, error: "Error fetching logs" })
  }
})

// Test TypeBot flow
app.post("/api/typebot/test/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params
    const { phone, message } = req.body

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: phone, message",
      })
    }

    const outbound = await handleTypeBotMessage(tenantId, phone, message, "text")

    if (!outbound) {
      return res.status(400).json({
        success: false,
        error: "No TypeBot flow configured for this tenant",
      })
    }

    return res.json({
      success: true,
      data: {
        messageCount: outbound.messages.length,
        messages: outbound.messages,
        delay: outbound.delay,
      },
    })
  } catch (error) {
    console.error("Test TypeBot flow error:", error)
    return res.status(500).json({ success: false, error: "Error testing flow" })
  }
})

// Helper function to mask phone numbers
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone
  const visible = phone.slice(0, -7)
  const masked = "*".repeat(Math.min(3, phone.length - 7))
  const lastDigits = phone.slice(-4)
  return `${visible}${masked}${lastDigits}`
}

// Get all sessions status
app.get("/api/whatsapp/sessions", (_req: Request, res: Response) => {
  const sessions = whatsappManager.getAllSessions()
  return res.json({ success: true, data: sessions })
})

// Get list of persisted sessions (sessions that have saved data)
app.get("/api/whatsapp/persisted-sessions", (_req: Request, res: Response) => {
  try {
    const persisted = whatsappManager.listPersistedSessions()
    const sessionDetails = persisted.map(sessionId => ({
      sessionId,
      metadata: whatsappManager.getSessionMetadata(sessionId),
    }))
    return res.json({ success: true, data: sessionDetails })
  } catch (error) {
    console.error("Error listing persisted sessions:", error)
    return res.status(500).json({ success: false, error: "Error listing persisted sessions" })
  }
})

// Delete persisted session data
app.delete("/api/whatsapp/session-data/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params
    
    // First disconnect if active (false = don't preserve session, do full logout)
    const engine = whatsappManager.getEngine(tenantId)
    if (engine) {
      const preserveSessionOnDelete = false
      await whatsappManager.removeEngine(tenantId, preserveSessionOnDelete)
    }
    
    // Delete persisted data
    const deleted = await whatsappManager.deleteSessionData(tenantId)
    
    if (deleted) {
      return res.json({ success: true, message: "Session data deleted successfully" })
    } else {
      return res.status(500).json({ success: false, error: "Failed to delete session data" })
    }
  } catch (error) {
    console.error("Error deleting session data:", error)
    return res.status(500).json({ success: false, error: "Error deleting session data" })
  }
})

// Debug: return engine status for a tenant
app.get("/api/whatsapp/debug/:tenantId", (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params
    const engine = whatsappManager.getEngine(tenantId)
    const hasPersistedSession = whatsappManager.hasExistingSession(tenantId)
    const metadata = whatsappManager.getSessionMetadata(tenantId)
    
    return res.json({ 
      success: true, 
      data: {
        engineStatus: engine?.getStatus() || null,
        hasPersistedSession,
        metadata,
      }
    })
  } catch (error) {
    console.error("Debug route error:", error)
    return res.status(500).json({ success: false, error: "Error retrieving debug status" })
  }
})

// Cleanup legacy session data (old shared "bot-session" clientId)
// This endpoint is admin-only and requires the ADMIN_SECRET header for manual invocation
// Note: This cleanup also runs automatically on server startup
app.post("/api/whatsapp/cleanup-legacy", async (req: Request, res: Response) => {
  try {
    // Basic admin check - require ADMIN_SECRET header or be localhost
    const adminSecret = process.env.ADMIN_SECRET
    const providedSecret = req.headers["x-admin-secret"]
    const isLocalhost = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1"
    
    if (adminSecret && providedSecret !== adminSecret && !isLocalhost) {
      console.warn("[Server] Unauthorized cleanup-legacy attempt")
      return res.status(403).json({ success: false, error: "Unauthorized" })
    }
    
    const cleaned = await whatsappManager.cleanupLegacySessionData()
    return res.json({ 
      success: true, 
      message: cleaned 
        ? "Legacy session data cleaned up successfully" 
        : "No legacy session data found to clean"
    })
  } catch (error) {
    console.error("Legacy cleanup error:", error)
    return res.status(500).json({ success: false, error: "Error cleaning up legacy session data" })
  }
})

// =====================================================
// MESSAGE QUEUE MANAGEMENT
// =====================================================

function startMessageQueue(tenantId: string, engine: WhatsAppEngine): void {
  if (activeQueues.has(tenantId)) {
    console.log(`[Queue] Queue already running for tenant ${tenantId}`)
    return
  }

  const queue = new MessageQueue(tenantId, engine, {
    batchSize: 10,
    intervalMs: 5000,
    maxRetries: 3,
  })

  queue.start()
  activeQueues.set(tenantId, queue)
  console.log(`[Queue] Started for tenant ${tenantId}`)
}

function stopMessageQueue(tenantId: string): void {
  const queue = activeQueues.get(tenantId)
  if (queue) {
    queue.stop()
    activeQueues.delete(tenantId)
    console.log(`[Queue] Stopped for tenant ${tenantId}`)
  }
}

// =====================================================
// SERVER STARTUP
// =====================================================

/**
 * Initialize active connections on server startup
 * 
 * This function implements robust session restoration:
 * 1. First, clean up any legacy session data from old shared clientId
 * 2. Check for persisted session data (LocalAuth files)
 * 3. Then, check database for sessions marked as connected
 * 4. Attempt to restore sessions that have persisted data
 */
async function initializeActiveConnections(): Promise<void> {
  try {
    // Clean up legacy session data from old shared "bot-session" clientId
    // This prevents Chromium profile lock conflicts
    console.log("[Server] Cleaning up legacy session data...")
    await whatsappManager.cleanupLegacySessionData()
    
    console.log("[Server] Checking for persisted sessions...")
    
    // Get list of sessions that have persisted data
    const persistedSessions = whatsappManager.listPersistedSessions()
    console.log(`[Server] Found ${persistedSessions.length} persisted sessions: ${persistedSessions.join(", ") || "none"}`)

    // Find all active WhatsApp sessions from database
    const dbSessions = await query<WhatsAppSession>(
      `SELECT ws.*, t.id as tenant_id 
       FROM whatsapp_sessions ws 
       JOIN tenants t ON ws.tenant_id = t.id 
       WHERE t.status = 'active'`
    )

    console.log(`[Server] Found ${dbSessions.length} sessions in database`)

    // Prioritize sessions that have both DB record and persisted data
    const sessionsToRestore = dbSessions.filter(session => {
      const hasPersisted = whatsappManager.hasExistingSession(session.tenant_id)
      if (hasPersisted) {
        const metadata = whatsappManager.getSessionMetadata(session.tenant_id)
        console.log(`[Server] Session ${session.tenant_id} has persisted data, last connected: ${metadata?.lastConnected || "unknown"}`)
      }
      return hasPersisted || session.status === "connected"
    })

    console.log(`[Server] Attempting to restore ${sessionsToRestore.length} sessions`)

    for (const session of sessionsToRestore) {
      try {
        // Update status to connecting before attempting restoration
        await update("whatsapp_sessions", session.id, {
          status: "connecting",
          updated_at: new Date().toISOString(),
        })

        const engine = await whatsappManager.createEngine(session.tenant_id, {
          onQRCode: async (qr: string) => {
            await update("whatsapp_sessions", session.id, {
              status: "qr_ready",
              qr_code: qr,
              updated_at: new Date().toISOString(),
            })
            console.log(`[Server] Session ${session.tenant_id} requires QR code scan`)
          },
          onReady: async (phoneNumber: string) => {
            await update("whatsapp_sessions", session.id, {
              status: "connected",
              phone_number: phoneNumber || null,
              qr_code: null,
              last_connected: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            console.log(`[Server] Session ${session.tenant_id} restored successfully`)
            
            // Initialize TypeBot bridge for this tenant
            await initializeTypeBotBridge(session.tenant_id)
            
            // Option A: Disable internal MessageQueue; rely on standalone queue-worker
            console.log(`[Server] Internal MessageQueue disabled for tenant ${session.tenant_id}.`)
          },
          onDisconnected: async (reason: string) => {
            await update("whatsapp_sessions", session.id, {
              status: "disconnected",
              updated_at: new Date().toISOString(),
            })
            console.log(`[Server] Session ${session.tenant_id} disconnected: ${reason}`)
            stopMessageQueue(session.tenant_id)
          },
        })

        await engine.initialize()
        console.log(`[Server] Initialized session restoration for tenant ${session.tenant_id}`)
      } catch (error) {
        console.error(`[Server] Failed to restore session for tenant ${session.tenant_id}:`, error)
        // Update status to error
        await update("whatsapp_sessions", session.id, {
          status: "error",
          updated_at: new Date().toISOString(),
        })
      }
    }
  } catch (error) {
    console.error("[Server] Error initializing active connections:", error)
  }
}

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err)
  res.status(500).json({ success: false, error: "Internal server error" })
})

// Start server
const server = app.listen(Number(PORT), HOST, () => {
  console.log(`[WhatsApp Server] Running on ${HOST}:${Number(PORT)}`)
  console.log(`[WhatsApp Server] Environment: ${process.env.NODE_ENV || "development"}`)

  // Initialize active connections after server starts
  initializeActiveConnections()
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[WhatsApp Server] SIGTERM received, shutting down gracefully...")

  // Stop all message queues
  for (const [tenantId, queue] of activeQueues) {
    queue.stop()
    console.log(`[Queue] Stopped queue for tenant ${tenantId}`)
  }

  // Disconnect all WhatsApp sessions
  const sessions = whatsappManager.getAllSessions()
  for (const session of sessions) {
    await whatsappManager.removeEngine(session.id)
  }

  // Close database pool
  await closePool()

  server.close(() => {
    console.log("[WhatsApp Server] Closed")
    process.exit(0)
  })
})

process.on("SIGINT", async () => {
  console.log("[WhatsApp Server] SIGINT received, shutting down...")
  await closePool()
  process.exit(0)
})

export { app }
