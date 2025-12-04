// =====================================================
// TYPEBOT BRIDGE - Standalone Server
// Bidirectional WhatsApp <-> TypeBot communication server
// =====================================================

import express, { Request, Response } from "express"
import cors from "cors"
import { createTypeBotBridge, InboundMessage, OutboundMessage, BridgeConfig } from "./integrations/typebot-bridge"
import { redisClient, closeRedis } from "./integrations/typebot-bridge/redis-client"
import axios from "axios"

const app = express()
const PORT = parseInt(process.env.TYPEBOT_BRIDGE_PORT || "3010", 10)

// Environment configuration
const CONFIG = {
  flowUrl: process.env.TYPEBOT_FLOW_URL || "https://bot.promolinxy.online/chatbot",
  token: process.env.TYPEBOT_TOKEN,
  enabled: process.env.TYPEBOT_ENABLED === "true",
  preferReupload: process.env.TYPEBOT_PREFER_REUPLOAD !== "false",
  enableUrlRewrite: process.env.TYPEBOT_ENABLE_URL_REWRITE === "true",
  whatsappSendUrl: process.env.WHATSAPP_SEND_URL || "http://whatsapp-engine:3001/api/whatsapp/send",
  sessionTtlHours: parseInt(process.env.TYPEBOT_SESSION_TTL_HOURS || "72", 10),
  defaultDelayMs: parseInt(process.env.TYPEBOT_DEFAULT_DELAY_MS || "500", 10),
  randomDelayMinMs: parseInt(process.env.TYPEBOT_RANDOM_DELAY_MIN_MS || "200", 10),
  randomDelayMaxMs: parseInt(process.env.TYPEBOT_RANDOM_DELAY_MAX_MS || "800", 10),
  rateLimitRps: parseInt(process.env.TYPEBOT_RATE_LIMIT_RPS || "5", 10),
  acceptOutside24h: process.env.TYPEBOT_ACCEPT_OUTSIDE_24H === "true",
}

// Store bridges per tenant
const bridges = new Map<string, ReturnType<typeof createTypeBotBridge>>()

// Middleware
app.use(cors())
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Request logging
app.use((req, res, next) => {
  const start = Date.now()
  res.on("finish", () => {
    const duration = Date.now() - start
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`)
  })
  next()
})

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
    console.log(`[TypeBot Bridge] Created bridge for tenant: ${tenantId}`)
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
    console.error("[TypeBot Bridge] Failed to send to WhatsApp:", error)
    throw error
  }
}

// =====================================================
// ROUTES
// =====================================================

/**
 * Health check
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "typebot-bridge",
    timestamp: new Date().toISOString(),
    config: {
      enabled: CONFIG.enabled,
      flowUrl: CONFIG.flowUrl,
      redis: redisClient.status,
    },
  })
})

/**
 * Handle incoming message from WhatsApp
 * POST /api/typebot/message
 */
app.post("/api/typebot/message", async (req: Request, res: Response) => {
  try {
    if (!CONFIG.enabled) {
      return res.status(503).json({ error: "TypeBot bridge is disabled" })
    }

    const { from, body, type, buttonId, listId, mediaUrl, tenantId } = req.body

    if (!from || !tenantId) {
      return res.status(400).json({ error: "Missing required fields: from, tenantId" })
    }

    console.log(`[TypeBot Bridge] Received message from ${from} (tenant: ${tenantId})`)

    // Create inbound message
    const inbound: InboundMessage = {
      from,
      body: body || "",
      type: type || "text",
      buttonId,
      listId,
      mediaUrl,
    }

    // Get bridge for tenant
    const bridge = getBridgeForTenant(tenantId)

    // Handle message
    const outbound = await bridge.handleInbound(inbound)

    if (outbound && outbound.messages.length > 0) {
      // Send messages to WhatsApp
      await sendToWhatsApp(outbound.messages, outbound.to, tenantId)
      
      res.json({
        success: true,
        messagesCount: outbound.messages.length,
        to: outbound.to,
      })
    } else {
      res.json({
        success: true,
        messagesCount: 0,
        message: "No response from TypeBot",
      })
    }
  } catch (error) {
    console.error("[TypeBot Bridge] Error processing message:", error)
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * Start new conversation
 * POST /api/typebot/start
 */
app.post("/api/typebot/start", async (req: Request, res: Response) => {
  try {
    if (!CONFIG.enabled) {
      return res.status(503).json({ error: "TypeBot bridge is disabled" })
    }

    const { phone, tenantId } = req.body

    if (!phone || !tenantId) {
      return res.status(400).json({ error: "Missing required fields: phone, tenantId" })
    }

    console.log(`[TypeBot Bridge] Starting conversation for ${phone} (tenant: ${tenantId})`)

    // Create inbound message with /start command
    const inbound: InboundMessage = {
      from: phone,
      body: "/start",
      type: "text",
    }

    // Get bridge for tenant
    const bridge = getBridgeForTenant(tenantId)

    // Handle message
    const outbound = await bridge.handleInbound(inbound)

    if (outbound && outbound.messages.length > 0) {
      // Send messages to WhatsApp
      await sendToWhatsApp(outbound.messages, outbound.to, tenantId)
      
      res.json({
        success: true,
        messagesCount: outbound.messages.length,
        to: outbound.to,
      })
    } else {
      res.status(500).json({
        error: "Failed to start conversation",
        message: "No response from TypeBot",
      })
    }
  } catch (error) {
    console.error("[TypeBot Bridge] Error starting conversation:", error)
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * Get session info
 * GET /api/typebot/session/:phone
 */
app.get("/api/typebot/session/:phone", async (req: Request, res: Response) => {
  try {
    const { phone } = req.params
    const { tenantId } = req.query

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId query parameter" })
    }

    // TODO: Implement session retrieval from Redis
    res.json({
      phone,
      tenantId,
      message: "Session info not yet implemented",
    })
  } catch (error) {
    console.error("[TypeBot Bridge] Error getting session:", error)
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * Get bridge statistics
 * GET /api/typebot/stats
 */
app.get("/api/typebot/stats", async (req: Request, res: Response) => {
  try {
    res.json({
      activeBridges: bridges.size,
      tenants: Array.from(bridges.keys()),
      redis: {
        status: redisClient.status,
      },
      config: {
        enabled: CONFIG.enabled,
        flowUrl: CONFIG.flowUrl,
        sessionTtlHours: CONFIG.sessionTtlHours,
      },
    })
  } catch (error) {
    console.error("[TypeBot Bridge] Error getting stats:", error)
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// =====================================================
// SERVER STARTUP
// =====================================================

async function startServer() {
  try {
    console.log("[TypeBot Bridge] Starting server...")
    console.log("[TypeBot Bridge] Configuration:", {
      port: PORT,
      enabled: CONFIG.enabled,
      flowUrl: CONFIG.flowUrl,
      whatsappSendUrl: CONFIG.whatsappSendUrl,
    })

    // Test Redis connection
    await redisClient.ping()
    console.log("[TypeBot Bridge] Redis connected")

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[TypeBot Bridge] Server listening on port ${PORT}`)
      console.log(`[TypeBot Bridge] Health check: http://0.0.0.0:${PORT}/health`)
    })
  } catch (error) {
    console.error("[TypeBot Bridge] Failed to start server:", error)
    process.exit(1)
  }
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function shutdown() {
  console.log("[TypeBot Bridge] Shutting down gracefully...")
  
  try {
    // Close Redis connection
    await closeRedis()
    console.log("[TypeBot Bridge] Redis closed")
    
    process.exit(0)
  } catch (error) {
    console.error("[TypeBot Bridge] Error during shutdown:", error)
    process.exit(1)
  }
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

// Start server
if (require.main === module) {
  startServer()
}

export { app, startServer }
