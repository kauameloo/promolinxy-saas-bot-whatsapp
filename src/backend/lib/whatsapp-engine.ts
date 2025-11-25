// =====================================================
// WHATSAPP ENGINE - Abstração para whatsapp-web.js
// =====================================================

import type {
  WhatsAppMessage,
  WhatsAppSessionInfo,
  WhatsAppEventHandlers,
  SendMessageResult,
} from "./types"

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
  private timers: NodeJS.Timeout[] = []

  // In production, this would be the whatsapp-web.js Client instance
  // private client: Client | null = null;

  constructor(sessionId: string, handlers: WhatsAppEventHandlers = {}) {
    this.sessionId = sessionId
    this.handlers = handlers
  }

  /**
   * Inicializa a sessão WhatsApp
   * Em produção, isso iniciaria o cliente whatsapp-web.js
   */
  async initialize(): Promise<void> {
    console.log(`[WhatsApp Engine] Initializing session: ${this.sessionId}`)
    this.status = "connecting"

    // =====================================================
    // PRODUCTION IMPLEMENTATION with whatsapp-web.js:
    // =====================================================
    // const { Client, LocalAuth } = require('whatsapp-web.js');
    //
    // this.client = new Client({
    //   authStrategy: new LocalAuth({
    //     clientId: this.sessionId,
    //     dataPath: process.env.WHATSAPP_SESSION_PATH || './sessions'
    //   }),
    //   puppeteer: {
    //     headless: true,
    //     executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    //     args: [
    //       '--no-sandbox',
    //       '--disable-setuid-sandbox',
    //       '--disable-dev-shm-usage',
    //       '--disable-accelerated-2d-canvas',
    //       '--no-first-run',
    //       '--no-zygote',
    //       '--single-process',
    //       '--disable-gpu'
    //     ]
    //   }
    // });
    //
    // this.client.on('qr', (qr) => {
    //   this.qrCode = qr;
    //   this.status = 'qr_ready';
    //   this.handlers.onQRCode?.(qr);
    // });
    //
    // this.client.on('ready', () => {
    //   this.status = 'connected';
    //   this.phoneNumber = this.client.info.wid.user;
    //   this.handlers.onReady?.(this.phoneNumber);
    // });
    //
    // this.client.on('authenticated', () => {
    //   console.log(`[WhatsApp ${this.sessionId}] Authenticated`);
    // });
    //
    // this.client.on('auth_failure', (msg) => {
    //   console.error(`[WhatsApp ${this.sessionId}] Auth failure:`, msg);
    //   this.status = 'error';
    // });
    //
    // this.client.on('disconnected', (reason) => {
    //   this.status = 'disconnected';
    //   this.handlers.onDisconnected?.(reason);
    // });
    //
    // this.client.on('message', (message) => {
    //   this.handlers.onMessage?.({
    //     from: message.from,
    //     body: message.body,
    //     timestamp: new Date(message.timestamp * 1000),
    //     isGroup: message.isGroupMsg,
    //   });
    // });
    //
    // await this.client.initialize();
    // =====================================================

    // DEMO MODE: Simulate QR code generation after 1 second
    const qrTimer = setTimeout(() => {
      if (this.status === "connecting") {
        this.qrCode = `DEMO_QR_${this.sessionId}_${Date.now()}`
        this.status = "qr_ready"
        this.handlers.onQRCode?.(this.qrCode)
      }
    }, 1000)
    this.timers.push(qrTimer)

    // DEMO MODE: Simulate connection after 5 seconds (auto-connect for demo)
    const connectTimer = setTimeout(() => {
      if (this.status === "qr_ready") {
        this.status = "connected"
        this.phoneNumber = "5511999999999" // Demo phone number
        this.handlers.onReady?.(this.phoneNumber)
      }
    }, 5000)
    this.timers.push(connectTimer)
  }

  /**
   * Envia uma mensagem de texto
   */
  async sendMessage(message: WhatsAppMessage): Promise<SendMessageResult> {
    if (this.status !== "connected") {
      return {
        success: false,
        error: "WhatsApp not connected",
      }
    }

    try {
      // PRODUCTION IMPLEMENTATION:
      // const chatId = message.to.includes('@c.us') ? message.to : `${message.to}@c.us`;
      // const result = await this.client.sendMessage(chatId, message.content);
      // return { success: true, messageId: result.id._serialized };

      console.log(
        `[WhatsApp Engine] Sending message to ${message.to}: ${message.content.substring(0, 50)}...`
      )

      // DEMO MODE: Simulate successful send
      return {
        success: true,
        messageId: `msg_${Date.now()}`,
      }
    } catch (error) {
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

    if (this.status !== "connected") {
      return {
        success: false,
        error: "WhatsApp not connected",
      }
    }

    try {
      // PRODUCTION IMPLEMENTATION:
      // const { MessageMedia } = require('whatsapp-web.js');
      // const media = await MessageMedia.fromUrl(message.mediaUrl);
      // const chatId = message.to.includes('@c.us') ? message.to : `${message.to}@c.us`;
      // const result = await this.client.sendMessage(chatId, media, { caption: message.content });
      // return { success: true, messageId: result.id._serialized };

      console.log(`[WhatsApp Engine] Sending media to ${message.to}`)

      // DEMO MODE
      return {
        success: true,
        messageId: `msg_media_${Date.now()}`,
      }
    } catch (error) {
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
    // PRODUCTION: Would reinitialize the client to get new QR
    this.status = "qr_ready"
    this.qrCode = `DEMO_QR_${this.sessionId}_${Date.now()}`
    return this.qrCode
  }

  /**
   * Desconecta a sessão
   */
  async disconnect(): Promise<void> {
    // Clear all pending timers to prevent memory leaks
    for (const timer of this.timers) {
      clearTimeout(timer)
    }
    this.timers = []

    // PRODUCTION:
    // await this.client?.logout();
    // await this.client?.destroy();

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
