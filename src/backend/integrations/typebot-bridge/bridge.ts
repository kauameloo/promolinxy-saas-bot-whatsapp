// =====================================================
// TYPEBOT BRIDGE - Bridge Controller
// Orchestrates bidirectional WhatsApp ↔ TypeBot communication
// =====================================================

import { TypeBotClient, createTypeBotClient } from "./typebot-client"
import { MessageMapper, createMessageMapper, WhatsAppMessage } from "./message-mapper"
import {
  getOrCreateSession,
  updateSession,
  getSession,
  storeLastOptions,
  getLastOptions,
  TypeBotSession,
} from "./redis-client"
import { query } from "../../lib/db"

// Input validation types
export type InputType = "text" | "number" | "email" | "phone" | "url" | "date" | "file"

// Bridge configuration
export interface BridgeConfig {
  flowUrl: string
  token?: string
  tenantId: string
  preferReupload?: boolean
  enableUrlRewrite?: boolean
  urlRewriteMap?: Record<string, string>
  delays?: {
    fixed?: number
    perMessage?: number
    random?: { min: number; max: number }
  }
}

// Inbound message from WhatsApp
export interface InboundMessage {
  from: string
  body: string
  type: "text" | "button_response" | "list_response"
  buttonId?: string
  listId?: string
  mediaUrl?: string
}

// Outbound message to WhatsApp
export interface OutboundMessage {
  to: string
  messages: WhatsAppMessage[]
  delay?: number
}

/**
 * TypeBot Bridge Controller
 * Main orchestrator for WhatsApp ↔ TypeBot integration
 */
export class TypeBotBridge {
  private client: TypeBotClient
  private mapper: MessageMapper
  private config: BridgeConfig

  constructor(config: BridgeConfig) {
    this.config = config
    this.client = createTypeBotClient(config.flowUrl, config.token)
    this.mapper = createMessageMapper({
      preferReupload: config.preferReupload ?? true,
      enableUrlRewrite: config.enableUrlRewrite ?? false,
      urlRewriteMap: config.urlRewriteMap,
    })
  }

  /**
   * Handle inbound message from WhatsApp
   * Returns outbound messages to send back to WhatsApp
   */
  async handleInbound(inbound: InboundMessage): Promise<OutboundMessage | null> {
    try {
      console.log("[TypeBot Bridge] Handling inbound message:", {
        from: this.maskPhone(inbound.from),
        type: inbound.type,
        bodyLength: inbound.body.length,
      })

      // Get or create session
      let session = await getOrCreateSession(
        inbound.from,
        this.config.tenantId,
        this.config.flowUrl
      )

      // Log inbound message
      await this.logMessage({
        phone: inbound.from,
        direction: "inbound",
        content: inbound.body,
        type: inbound.type,
        sessionId: session.sessionId,
        tenantId: this.config.tenantId,
      })

      let responseMessages: WhatsAppMessage[]
      let inputType: InputType | undefined

      // Start new chat or continue existing
      if (!session.sessionId || inbound.body.toLowerCase() === "/start") {
        // Start new chat
        const response = await this.client.startChat({
          phone: inbound.from,
          tenantId: this.config.tenantId,
        })

        session.sessionId = response.sessionId
        await updateSession(inbound.from, { sessionId: response.sessionId })

        // Map messages
        responseMessages = await this.mapper.mapMessages(response.messages, response.input)
        inputType = response.input?.type as InputType | undefined

        // Store options if present
        if (response.messages.some((m) => m.items || m.options)) {
          await this.storeOptionsFromMessages(session.sessionId, response.messages)
        }
      } else {
        // Continue existing chat
        let userMessage = inbound.body

        // Handle button/list responses
        if (inbound.type === "button_response" && inbound.buttonId) {
          userMessage = await this.resolveOptionId(session.sessionId, inbound.buttonId)
        } else if (inbound.type === "list_response" && inbound.listId) {
          userMessage = await this.resolveOptionId(session.sessionId, inbound.listId)
        }

        // Validate input if needed (basic validation)
        // More sophisticated validation can be added here

        const response = await this.client.continueChat(session.sessionId, userMessage)

        // Map messages
        responseMessages = await this.mapper.mapMessages(response.messages, response.input)
        inputType = response.input?.type as InputType | undefined

        // Store options if present
        if (response.messages.some((m) => m.items || m.options)) {
          await this.storeOptionsFromMessages(session.sessionId, response.messages)
        }
      }

      // Update session
      await updateSession(inbound.from, {
        lastUserMessage: inbound.body,
        lastActivityAt: new Date().toISOString(),
      })

      // Log outbound messages
      for (const msg of responseMessages) {
        await this.logMessage({
          phone: inbound.from,
          direction: "outbound",
          content: this.messageToString(msg),
          type: msg.type,
          sessionId: session.sessionId,
          tenantId: this.config.tenantId,
        })
      }

      // Calculate delay
      const delay = this.calculateDelay(responseMessages.length)

      return {
        to: inbound.from,
        messages: responseMessages,
        delay,
      }
    } catch (error) {
      console.error("[TypeBot Bridge] Error handling inbound:", error)

      // Log error
      await this.logError({
        phone: inbound.from,
        error: error instanceof Error ? error.message : String(error),
        context: "handleInbound",
        tenantId: this.config.tenantId,
      })

      // Return error message
      return {
        to: inbound.from,
        messages: [
          {
            type: "text",
            text: "Sorry, an error occurred. Please try again or type /start to restart.",
          },
        ],
      }
    }
  }

  /**
   * Store options from TypeBot messages for later resolution
   */
  private async storeOptionsFromMessages(
    sessionId: string,
    messages: Array<{ items?: unknown[]; options?: unknown[] }>
  ): Promise<void> {
    const optionsMap: Record<string, string> = {}

    for (const message of messages) {
      // From items (buttons)
      if (message.items && Array.isArray(message.items)) {
        for (const item of message.items) {
          const typedItem = item as { id?: string; content?: string }
          if (typedItem.id && typedItem.content) {
            optionsMap[typedItem.id] = typedItem.content
          }
        }
      }

      // From options (lists)
      if (message.options && Array.isArray(message.options)) {
        for (const option of message.options) {
          const typedOption = option as { id?: string; label?: string }
          if (typedOption.id && typedOption.label) {
            optionsMap[typedOption.id] = typedOption.label
          }
        }
      }
    }

    if (Object.keys(optionsMap).length > 0) {
      await storeLastOptions(sessionId, optionsMap)
    }
  }

  /**
   * Resolve option ID to label text
   */
  private async resolveOptionId(sessionId: string, optionId: string): Promise<string> {
    const options = await getLastOptions(sessionId)
    return options?.[optionId] || optionId
  }

  /**
   * Calculate delay based on configuration
   */
  private calculateDelay(messageCount: number): number {
    if (!this.config.delays) return 0

    let delay = 0

    if (this.config.delays.fixed) {
      delay += this.config.delays.fixed
    }

    if (this.config.delays.perMessage) {
      delay += this.config.delays.perMessage * messageCount
    }

    if (this.config.delays.random) {
      const { min, max } = this.config.delays.random
      delay += Math.floor(Math.random() * (max - min + 1)) + min
    }

    return delay
  }

  /**
   * Convert WhatsApp message to string for logging
   */
  private messageToString(message: WhatsAppMessage): string {
    switch (message.type) {
      case "text":
        return message.text
      case "media":
        return `[Media: ${message.mediaType}]`
      case "buttons":
        return `${message.text} [Buttons: ${message.buttons.map((b) => b.label).join(", ")}]`
      case "list":
        return `${message.text} [List: ${message.sections[0]?.rows.length || 0} options]`
      default:
        return "[Unknown message type]"
    }
  }

  /**
   * Mask phone number for privacy
   */
  private maskPhone(phone: string): string {
    if (phone.length < 8) return phone
    const visible = phone.slice(0, -7)
    const masked = "*".repeat(Math.min(3, phone.length - 7))
    const lastDigits = phone.slice(-4)
    return `${visible}${masked}${lastDigits}`
  }

  /**
   * Log message to database
   */
  private async logMessage(data: {
    phone: string
    direction: "inbound" | "outbound"
    content: string
    type: string
    sessionId: string
    tenantId: string
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO typebot_logs 
         (tenant_id, phone, session_id, direction, content, message_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          data.tenantId,
          data.phone,
          data.sessionId,
          data.direction,
          data.content,
          data.type,
        ]
      )
    } catch (error) {
      console.error("[TypeBot Bridge] Failed to log message:", error)
    }
  }

  /**
   * Log error to database
   */
  private async logError(data: {
    phone: string
    error: string
    context: string
    tenantId: string
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO typebot_logs 
         (tenant_id, phone, direction, content, message_type, error_message, created_at)
         VALUES ($1, $2, 'error', $3, 'error', $4, NOW())`,
        [data.tenantId, data.phone, data.context, data.error]
      )
    } catch (error) {
      console.error("[TypeBot Bridge] Failed to log error:", error)
    }
  }

  /**
   * Update bridge configuration
   */
  updateConfig(config: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...config }

    // Update mapper config if needed
    if (
      config.preferReupload !== undefined ||
      config.enableUrlRewrite !== undefined ||
      config.urlRewriteMap !== undefined
    ) {
      this.mapper.updateConfig({
        preferReupload: config.preferReupload,
        enableUrlRewrite: config.enableUrlRewrite,
        urlRewriteMap: config.urlRewriteMap,
      })
    }
  }
}

/**
 * Create a TypeBot bridge instance
 */
export function createTypeBotBridge(config: BridgeConfig): TypeBotBridge {
  return new TypeBotBridge(config)
}
