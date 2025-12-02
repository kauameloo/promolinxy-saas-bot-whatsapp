// =====================================================
// WHATSAPP SERVER - Backend WhatsApp Engine Service
// =====================================================

import { WhatsAppEngine, whatsappManager } from "./lib/whatsapp-engine"
import { MessageQueue } from "./lib/message-queue"
import { query, queryOne, update, dbPool, closePool } from "./lib/db"
import type { WhatsAppSession, Tenant } from "./lib/types"
import express, { Application, Request, Response, NextFunction } from "express"
import cors from "cors"

const app: Application = express()
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
          phone_number: phoneNumber || null,
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
            startMessageQueue(session.tenant_id, engine)
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
