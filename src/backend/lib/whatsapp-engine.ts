// =====================================================
// WHATSAPP ENGINE - Abstração para whatsapp-web.js
// =====================================================

import type {
  WhatsAppMessage,
  WhatsAppSessionInfo,
  WhatsAppEventHandlers,
  SendMessageResult,
} from "./types"

// Import whatsapp-web.js
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js"
import * as qrcode from "qrcode-terminal"

/**
 * WhatsApp Engine abstraction layer
 *
 * Esta classe fornece uma interface para o whatsapp-web.js
 * Em produção, integra com a biblioteca whatsapp-web.js real
 */
export class WhatsAppEngine {
  private sessionId: string
  private handlers: WhatsAppEventHandlers
  private status: WhatsAppSessionInfo["status"] = "disconnected"
  private qrCode: string | null = null
  private phoneNumber: string | null = null
  private client: Client | null = null

  constructor(sessionId: string, handlers: WhatsAppEventHandlers = {}) {
    this.sessionId = sessionId
    this.handlers = handlers
  }

  /**
   * Inicializa a sessão WhatsApp
   */
  async initialize(): Promise<void> {
    console.log(`[WhatsApp Engine] Initializing session: ${this.sessionId}`)
    this.status = "connecting"

    // Create WhatsApp client with LocalAuth for session persistence
    const dataPath = process.env.WHATSAPP_SESSION_PATH || "./sessions"
    // Prefer an explicit client id (to mimic your working example), fallback to sessionId
    const clientId = process.env.WHATSAPP_CLIENT_ID || "bot-session"
    console.log(`[WhatsApp Engine] Using LocalAuth dataPath: ${dataPath}, clientId: ${clientId}`)
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId,
        dataPath,
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      },
    })

    // Handle QR code event
    this.client.on("qr", (qr: string) => {
      this.qrCode = qr
      this.status = "qr_ready"
      console.log(`[WhatsApp ${this.sessionId}] QR Code received (length=${qr?.length})`)
      // Log a short prefix of the QR payload for debugging (avoid logging full potentially large string)
      try {
        console.log(`[WhatsApp ${this.sessionId}] QR preview: ${qr?.substring(0, 120)}`)
      } catch (e) {
        // ignore
      }
      // Print QR code to terminal for debugging
      qrcode.generate(qr, { small: true })
      this.handlers.onQRCode?.(qr)
    })

    // Handle ready event
    this.client.on("ready", () => {
      this.status = "connected"
      const info = this.client?.info
      this.phoneNumber = info?.wid?.user || null
      console.log(`[WhatsApp ${this.sessionId}] Ready - Phone: ${this.phoneNumber}`)
      if (this.phoneNumber) {
        this.handlers.onReady?.(this.phoneNumber)
      }
    })

    // Handle authenticated event
    this.client.on("authenticated", () => {
      console.log(`[WhatsApp ${this.sessionId}] Authenticated`)
    })

    // Handle auth failure event
    this.client.on("auth_failure", (msg: string) => {
      console.error(`[WhatsApp ${this.sessionId}] Auth failure:`, msg)
      this.status = "error"
    })

    // Handle disconnected event
    this.client.on("disconnected", (reason: string) => {
      this.status = "disconnected"
      console.log(`[WhatsApp ${this.sessionId}] Disconnected:`, reason)
      this.handlers.onDisconnected?.(reason)
    })

    // Handle incoming messages
    this.client.on("message", (message: any) => {
      // Guard against null/undefined message properties
      if (!message?.from || !message?.body) {
        console.warn(`[WhatsApp ${this.sessionId}] Received message with missing properties`)
        return
      }
      this.handlers.onMessage?.({
        from: message.from,
        body: message.body,
        timestamp: new Date(message.timestamp * 1000),
        isGroup: message.from.includes("@g.us"),
      })
    })

    // Initialize the client
    await this.client.initialize()
  }

  /**
   * Envia uma mensagem de texto
   */
  async sendMessage(message: WhatsAppMessage): Promise<SendMessageResult> {
    if (this.status !== "connected" || !this.client) {
      return {
        success: false,
        error: "WhatsApp not connected",
      }
    }

    try {
      const chatId = message.to.includes("@c.us") ? message.to : `${message.to}@c.us`
      const result = await this.client.sendMessage(chatId, message.content)
      
      console.log(
        `[WhatsApp Engine] Message sent to ${message.to}: ${message.content.substring(0, 50)}...`
      )

      return {
        success: true,
        messageId: result.id._serialized,
      }
    } catch (error) {
      console.error(`[WhatsApp Engine] Send message error:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Envia mensagem com mídia
   */
  async sendMediaMessage(message: WhatsAppMessage): Promise<SendMessageResult> {
    if (!message.mediaUrl) {
      return this.sendMessage(message)
    }

    if (this.status !== "connected" || !this.client) {
      return {
        success: false,
        error: "WhatsApp not connected",
      }
    }

    try {
      const media = await MessageMedia.fromUrl(message.mediaUrl)
      const chatId = message.to.includes("@c.us") ? message.to : `${message.to}@c.us`
      const result = await this.client.sendMessage(chatId, media, { caption: message.content })
      
      console.log(`[WhatsApp Engine] Media sent to ${message.to}`)

      return {
        success: true,
        messageId: result.id._serialized,
      }
    } catch (error) {
      console.error(`[WhatsApp Engine] Send media error:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Obtém o status atual da sessão
   */
  getStatus(): WhatsAppSessionInfo {
    return {
      id: this.sessionId,
      status: this.status,
      qrCode: this.qrCode || undefined,
      phoneNumber: this.phoneNumber || undefined,
    }
  }

  /**
   * Gera novo QR Code
   */
  async refreshQRCode(): Promise<string | null> {
    try {
      // Reinitialize to get new QR code
      if (this.client) {
        await this.disconnect()
      }
      await this.initialize()
      return this.qrCode
    } catch (error) {
      console.error(`[WhatsApp Engine] Error refreshing QR code:`, error)
      this.status = "error"
      return null
    }
  }

  /**
   * Desconecta a sessão
   */
  async disconnect(): Promise<void> {
    const client = this.client
    this.client = null
    
    if (client) {
      try {
        await client.logout()
      } catch (error) {
        // Log but don't throw - logout may fail if already disconnected
        console.warn(`[WhatsApp Engine] Logout warning:`, error)
      }
      try {
        await client.destroy()
      } catch (error) {
        // Log but don't throw - destroy may fail if already destroyed
        console.warn(`[WhatsApp Engine] Destroy warning:`, error)
      }
    }

    this.status = "disconnected"
    this.qrCode = null
    this.phoneNumber = null
    console.log(`[WhatsApp Engine] Session ${this.sessionId} disconnected`)
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.status === "connected"
  }
}

// =====================================================
// WHATSAPP MANAGER - Singleton para múltiplas sessões
// =====================================================

class WhatsAppManager {
  private engines: Map<string, WhatsAppEngine> = new Map()

  getEngine(sessionId: string): WhatsAppEngine | undefined {
    return this.engines.get(sessionId)
  }

  async createEngine(
    sessionId: string,
    handlers: WhatsAppEventHandlers = {}
  ): Promise<WhatsAppEngine> {
    if (this.engines.has(sessionId)) {
      return this.engines.get(sessionId)!
    }

    const engine = new WhatsAppEngine(sessionId, handlers)
    this.engines.set(sessionId, engine)
    return engine
  }

  async removeEngine(sessionId: string): Promise<void> {
    const engine = this.engines.get(sessionId)
    if (engine) {
      await engine.disconnect()
      this.engines.delete(sessionId)
    }
  }

  getAllSessions(): WhatsAppSessionInfo[] {
    return Array.from(this.engines.values()).map((e) => e.getStatus())
  }
}

export const whatsappManager = new WhatsAppManager()
