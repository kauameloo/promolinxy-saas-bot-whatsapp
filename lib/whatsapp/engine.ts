// =====================================================
// WHATSAPP ENGINE - Abstração para whatsapp-web.js
// =====================================================

import type { WhatsAppMessage, WhatsAppSession, WhatsAppEventHandlers, SendMessageResult } from "./types"

/**
 * WhatsApp Engine abstraction layer
 *
 * Esta classe fornece uma interface para o whatsapp-web.js
 * Em produção, deve ser executada em um servidor Node.js separado
 * devido às dependências do Puppeteer/Chrome
 */
export class WhatsAppEngine {
  private sessionId: string
  private handlers: WhatsAppEventHandlers
  private status: WhatsAppSession["status"] = "disconnected"
  private qrCode: string | null = null

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

    // Simulação - Em produção, usaria whatsapp-web.js:
    // const { Client, LocalAuth } = require('whatsapp-web.js');
    // this.client = new Client({
    //   authStrategy: new LocalAuth({ clientId: this.sessionId }),
    //   puppeteer: {
    //     headless: true,
    //     args: ['--no-sandbox', '--disable-setuid-sandbox']
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
    //   this.handlers.onReady?.(this.client.info.wid.user);
    // });
    //
    // await this.client.initialize();
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
      // Em produção:
      // const chatId = message.to.includes('@c.us') ? message.to : `${message.to}@c.us`;
      // const result = await this.client.sendMessage(chatId, message.content);
      // return { success: true, messageId: result.id._serialized };

      console.log(`[WhatsApp Engine] Sending message to ${message.to}: ${message.content.substring(0, 50)}...`)

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

    try {
      // Em produção:
      // const { MessageMedia } = require('whatsapp-web.js');
      // const media = await MessageMedia.fromUrl(message.mediaUrl);
      // const chatId = message.to.includes('@c.us') ? message.to : `${message.to}@c.us`;
      // const result = await this.client.sendMessage(chatId, media, { caption: message.content });
      // return { success: true, messageId: result.id._serialized };

      console.log(`[WhatsApp Engine] Sending media to ${message.to}`)

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
  getStatus(): WhatsAppSession {
    return {
      id: this.sessionId,
      status: this.status,
      qrCode: this.qrCode || undefined,
    }
  }

  /**
   * Gera novo QR Code
   */
  async refreshQRCode(): Promise<string | null> {
    // Em produção, isso forçaria nova geração de QR
    this.status = "qr_ready"
    return this.qrCode
  }

  /**
   * Desconecta a sessão
   */
  async disconnect(): Promise<void> {
    // Em produção:
    // await this.client?.logout();
    // await this.client?.destroy();

    this.status = "disconnected"
    this.qrCode = null
    console.log(`[WhatsApp Engine] Session ${this.sessionId} disconnected`)
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.status === "connected"
  }
}

// Singleton para gerenciar múltiplas sessões
class WhatsAppManager {
  private engines: Map<string, WhatsAppEngine> = new Map()

  getEngine(sessionId: string): WhatsAppEngine | undefined {
    return this.engines.get(sessionId)
  }

  async createEngine(sessionId: string, handlers: WhatsAppEventHandlers = {}): Promise<WhatsAppEngine> {
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

  getAllSessions(): WhatsAppSession[] {
    return Array.from(this.engines.values()).map((e) => e.getStatus())
  }
}

export const whatsappManager = new WhatsAppManager()
