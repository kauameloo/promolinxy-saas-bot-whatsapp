// =====================================================
// WHATSAPP SERVER - Backend WhatsApp Engine Service
// =====================================================

import { WhatsAppEngine, whatsappManager } from "./lib/whatsapp-engine"
import { MessageQueue } from "./lib/message-queue"
import { query, queryOne, update, dbPool, closePool } from "./lib/db"
import type { WhatsAppSession, Tenant } from "./lib/types"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"

const app = express()
const PORT = process.env.WHATSAPP_PORT || 3001

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
          phone_number: phoneNumber,
          qr_code: null,
          last_connected: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        console.log(`[WhatsApp ${tenantId}] Connected: ${phoneNumber}`)

        // Start message queue for this tenant
        startMessageQueue(tenantId, engine)
      },
      onDisconnected: async (reason: string) => {
        await update("whatsapp_sessions", session!.id, {
          status: "disconnected",
          updated_at: new Date().toISOString(),
        })
        console.log(`[WhatsApp ${tenantId}] Disconnected: ${reason}`)

        // Stop message queue
        stopMessageQueue(tenantId)
      },
      onMessage: async (message) => {
        console.log(`[WhatsApp ${tenantId}] Incoming message from ${message.from}: ${message.body}`)
        // Handle incoming messages - could trigger flows, etc.
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

    await whatsappManager.removeEngine(tenantId)
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

    return res.json({ success: true, message: "Disconnected successfully" })
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

async function initializeActiveConnections(): Promise<void> {
  try {
    // Find all active WhatsApp sessions and try to reconnect
    const sessions = await query<WhatsAppSession>(
      `SELECT ws.*, t.id as tenant_id 
       FROM whatsapp_sessions ws 
       JOIN tenants t ON ws.tenant_id = t.id 
       WHERE ws.status = 'connected' AND t.status = 'active'`
    )

    console.log(`[Server] Found ${sessions.length} active sessions to reconnect`)

    for (const session of sessions) {
      try {
        const engine = await whatsappManager.createEngine(session.tenant_id, {
          onQRCode: async (qr: string) => {
            await update("whatsapp_sessions", session.id, {
              status: "qr_ready",
              qr_code: qr,
              updated_at: new Date().toISOString(),
            })
          },
          onReady: async (phoneNumber: string) => {
            await update("whatsapp_sessions", session.id, {
              status: "connected",
              phone_number: phoneNumber,
              qr_code: null,
              last_connected: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            startMessageQueue(session.tenant_id, engine)
          },
          onDisconnected: async (reason: string) => {
            await update("whatsapp_sessions", session.id, {
              status: "disconnected",
              updated_at: new Date().toISOString(),
            })
            stopMessageQueue(session.tenant_id)
          },
        })

        await engine.initialize()
        console.log(`[Server] Reconnecting session for tenant ${session.tenant_id}`)
      } catch (error) {
        console.error(`[Server] Failed to reconnect session for tenant ${session.tenant_id}:`, error)
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
const server = app.listen(PORT, () => {
  console.log(`[WhatsApp Server] Running on port ${PORT}`)
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
