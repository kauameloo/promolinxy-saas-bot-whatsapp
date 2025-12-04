// =====================================================
// TYPEBOT BRIDGE - Worker Process
// Background worker for processing queued messages
// =====================================================

import { redisClient, closeRedis } from "./integrations/typebot-bridge/redis-client"
import { createTypeBotBridge, BridgeConfig } from "./integrations/typebot-bridge"
import axios from "axios"

// Environment configuration
const CONFIG = {
  flowUrl: process.env.TYPEBOT_FLOW_URL || "https://bot.promolinxy.online/chatbot",
  token: process.env.TYPEBOT_TOKEN,
  preferReupload: process.env.TYPEBOT_PREFER_REUPLOAD !== "false",
  enableUrlRewrite: process.env.TYPEBOT_ENABLE_URL_REWRITE === "true",
  whatsappSendUrl: process.env.WHATSAPP_SEND_URL || "http://whatsapp-engine:3001/api/whatsapp/send",
  sessionTtlHours: parseInt(process.env.TYPEBOT_SESSION_TTL_HOURS || "72", 10),
  defaultDelayMs: parseInt(process.env.TYPEBOT_DEFAULT_DELAY_MS || "500", 10),
  randomDelayMinMs: parseInt(process.env.TYPEBOT_RANDOM_DELAY_MIN_MS || "200", 10),
  randomDelayMaxMs: parseInt(process.env.TYPEBOT_RANDOM_DELAY_MAX_MS || "800", 10),
  workerIntervalMs: parseInt(process.env.TYPEBOT_WORKER_INTERVAL_MS || "5000", 10),
}

// Store bridges per tenant
const bridges = new Map<string, ReturnType<typeof createTypeBotBridge>>()

/**
 * Get or create bridge for tenant
 */
function getBridgeForTenant(tenantId: string): ReturnType<typeof createTypeBotBridge> {
  if (!bridges.has(tenantId)) {
    const bridgeConfig: BridgeConfig = {
      flowUrl: CONFIG.flowUrl,
      token: CONFIG.token,
      tenantId,
      preferReupload: CONFIG.preferReupload,
      enableUrlRewrite: CONFIG.enableUrlRewrite,
      delays: {
        fixed: CONFIG.defaultDelayMs,
        random: {
          min: CONFIG.randomDelayMinMs,
          max: CONFIG.randomDelayMaxMs,
        },
      },
    }
    
    const bridge = createTypeBotBridge(bridgeConfig)
    bridges.set(tenantId, bridge)
    console.log(`[TypeBot Worker] Created bridge for tenant: ${tenantId}`)
  }
  
  return bridges.get(tenantId)!
}

/**
 * Send messages to WhatsApp via engine
 */
async function sendToWhatsApp(messages: any[], to: string, tenantId: string): Promise<void> {
  try {
    for (const message of messages) {
      const payload = {
        to,
        message,
        tenantId,
      }
      
      await axios.post(CONFIG.whatsappSendUrl, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      })
      
      // Small delay between messages
      if (messages.length > 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.defaultDelayMs))
      }
    }
  } catch (error) {
    console.error("[TypeBot Worker] Failed to send to WhatsApp:", error)
    throw error
  }
}

/**
 * Process message queue (if needed)
 */
async function processQueue(): Promise<void> {
  try {
    // This is a placeholder for queue processing
    // In a real implementation, you would:
    // 1. Pull messages from a Redis queue
    // 2. Process them through the bridge
    // 3. Send responses to WhatsApp
    // 4. Handle retries and failures
    
    // For now, we just do nothing - queuing will be added later if needed
  } catch (error) {
    console.error("[TypeBot Worker] Error processing queue:", error)
  }
}

/**
 * Cleanup expired sessions
 */
async function cleanupSessions(): Promise<void> {
  try {
    // Get all session keys from Redis
    const pattern = "typebot:session:*"
    const keys = await redisClient.keys(pattern)
    
    const now = Date.now()
    const ttlMs = CONFIG.sessionTtlHours * 60 * 60 * 1000
    
    let cleanedCount = 0
    
    for (const key of keys) {
      try {
        // Get session data
        const sessionData = await redisClient.get(key)
        if (!sessionData) continue
        
        const session = JSON.parse(sessionData)
        const lastActivity = new Date(session.lastActivity || session.createdAt).getTime()
        
        // Check if session is expired
        if (now - lastActivity > ttlMs) {
          await redisClient.del(key)
          cleanedCount++
          console.log(`[TypeBot Worker] Cleaned expired session: ${key}`)
        }
      } catch (error) {
        console.error(`[TypeBot Worker] Error cleaning session ${key}:`, error)
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[TypeBot Worker] Cleaned ${cleanedCount} expired sessions`)
    }
  } catch (error) {
    console.error("[TypeBot Worker] Error during session cleanup:", error)
  }
}

/**
 * Main worker loop
 */
async function workerLoop(): Promise<void> {
  console.log("[TypeBot Worker] Starting worker loop...")
  
  let iteration = 0
  
  while (true) {
    try {
      iteration++
      
      // Process queue every iteration
      await processQueue()
      
      // Cleanup sessions every 10 iterations (~50 seconds with default interval)
      if (iteration % 10 === 0) {
        await cleanupSessions()
      }
      
      // Wait before next iteration
      await new Promise(resolve => setTimeout(resolve, CONFIG.workerIntervalMs))
    } catch (error) {
      console.error("[TypeBot Worker] Error in worker loop:", error)
      // Continue running even if there's an error
      await new Promise(resolve => setTimeout(resolve, CONFIG.workerIntervalMs))
    }
  }
}

/**
 * Start worker
 */
async function startWorker(): Promise<void> {
  try {
    console.log("[TypeBot Worker] Starting...")
    console.log("[TypeBot Worker] Configuration:", {
      flowUrl: CONFIG.flowUrl,
      sessionTtlHours: CONFIG.sessionTtlHours,
      workerIntervalMs: CONFIG.workerIntervalMs,
    })

    // Test Redis connection
    await redisClient.ping()
    console.log("[TypeBot Worker] Redis connected")

    // Start worker loop
    await workerLoop()
  } catch (error) {
    console.error("[TypeBot Worker] Failed to start:", error)
    process.exit(1)
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log("[TypeBot Worker] Shutting down gracefully...")
  
  try {
    // Close Redis connection
    await closeRedis()
    console.log("[TypeBot Worker] Redis closed")
    
    process.exit(0)
  } catch (error) {
    console.error("[TypeBot Worker] Error during shutdown:", error)
    process.exit(1)
  }
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

// Start worker
if (require.main === module) {
  startWorker()
}

export { startWorker }
