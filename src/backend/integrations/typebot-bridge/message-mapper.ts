// =====================================================
// TYPEBOT BRIDGE - Message Mapper (TypeBot → WhatsApp)
// =====================================================

import { TypeBotMessage, TypeBotInput } from "./typebot-client"
import axios from "axios"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

// WhatsApp Message Types
export interface WhatsAppTextMessage {
  type: "text"
  text: string
}

export interface WhatsAppMediaMessage {
  type: "media"
  mediaType: "image" | "video" | "audio" | "document"
  mediaUrl?: string
  mediaPath?: string
  caption?: string
}

export interface WhatsAppButtonsMessage {
  type: "buttons"
  text: string
  buttons: Array<{
    id: string
    label: string
  }>
}

export interface WhatsAppListMessage {
  type: "list"
  text: string
  title: string
  buttonText: string
  sections: Array<{
    title: string
    rows: Array<{
      id: string
      title: string
      description?: string
    }>
  }>
}

export type WhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppMediaMessage
  | WhatsAppButtonsMessage
  | WhatsAppListMessage

// Mapper configuration
export interface MapperConfig {
  preferReupload: boolean
  enableUrlRewrite: boolean
  urlRewriteMap?: Record<string, string>
}

const DEFAULT_CONFIG: MapperConfig = {
  preferReupload: true,
  enableUrlRewrite: false,
  urlRewriteMap: {},
}

/**
 * Message Mapper
 * Converts TypeBot messages to WhatsApp-compatible format
 */
export class MessageMapper {
  private config: MapperConfig

  constructor(config: Partial<MapperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Map TypeBot messages to WhatsApp messages
   */
  async mapMessages(
    messages: TypeBotMessage[],
    input?: TypeBotInput
  ): Promise<WhatsAppMessage[]> {
    const whatsappMessages: WhatsAppMessage[] = []

    for (const message of messages) {
      // Text messages
      if (message.type === "text") {
        const text = this.extractText(message)
        if (text) {
          whatsappMessages.push({
            type: "text",
            text: this.applyUrlRewrite(text),
          })
        }
      }

      // Media messages
      else if (this.isMediaMessage(message)) {
        const mediaMsg = await this.mapMediaMessage(message)
        if (mediaMsg) {
          whatsappMessages.push(mediaMsg)
        }
      }

      // Choice messages (buttons/lists)
      else if (message.type === "choice" || message.items || message.options) {
        const choiceMsg = this.mapChoiceMessage(message)
        if (choiceMsg) {
          whatsappMessages.push(choiceMsg)
        }
      }
    }

    // Add input prompt if present
    if (input) {
      const inputMsg = this.mapInputMessage(input)
      if (inputMsg) {
        whatsappMessages.push(inputMsg)
      }
    }

    return whatsappMessages
  }

  /**
   * Extract text from TypeBot message
   */
  private extractText(message: TypeBotMessage): string {
    if (message.text) {
      return message.text
    }

    if (message.content?.richText) {
      const texts: string[] = []
      for (const element of message.content.richText) {
        if (element.children) {
          for (const child of element.children) {
            if (child.text) {
              texts.push(child.text)
            }
          }
        }
      }
      return texts.join("")
    }

    return ""
  }

  /**
   * Check if message is a media message
   */
  private isMediaMessage(message: TypeBotMessage): boolean {
    return (
      message.type === "image" ||
      message.type === "video" ||
      message.type === "audio" ||
      (message.type === "embed" && !!message.content?.url)
    )
  }

  /**
   * Map media message
   */
  private async mapMediaMessage(message: TypeBotMessage): Promise<WhatsAppMediaMessage | null> {
    const url = message.url || message.content?.url
    if (!url) return null

    const mediaType = this.getMediaType(message)
    if (!mediaType) return null

    let mediaPath: string | undefined
    let mediaUrl: string | undefined

    // Reupload media if configured
    if (this.config.preferReupload) {
      try {
        mediaPath = await this.downloadMedia(url)
      } catch (error) {
        console.error("[Message Mapper] Failed to download media:", error)
        // Fallback to URL
        mediaUrl = url
      }
    } else {
      mediaUrl = url
    }

    return {
      type: "media",
      mediaType,
      mediaUrl,
      mediaPath,
      caption: this.extractText(message) || undefined,
    }
  }

  /**
   * Get media type from TypeBot message
   */
  private getMediaType(message: TypeBotMessage): "image" | "video" | "audio" | "document" | null {
    if (message.type === "image") return "image"
    if (message.type === "video") return "video"
    if (message.type === "audio") return "audio"

    if (message.type === "embed" && message.content?.type) {
      const contentType = message.content.type.toLowerCase()
      if (contentType.includes("image")) return "image"
      if (contentType.includes("video")) return "video"
      if (contentType.includes("audio")) return "audio"
      if (contentType.includes("pdf") || contentType.includes("document")) return "document"
    }

    return null
  }

  /**
   * Download media to temporary file
   */
  private async downloadMedia(url: string): Promise<string> {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
    })

    // Get file extension from URL or content type
    const ext = path.extname(new URL(url).pathname) || this.getExtensionFromContentType(response.headers["content-type"])
    const filename = `media_${Date.now()}${ext}`
    const filepath = path.join(os.tmpdir(), filename)

    await fs.promises.writeFile(filepath, response.data)

    console.log("[Message Mapper] Downloaded media:", filepath)
    return filepath
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType?: string): string {
    if (!contentType) return ""

    const map: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
      "audio/wav": ".wav",
      "application/pdf": ".pdf",
    }

    return map[contentType] || ""
  }

  /**
   * Map choice message (buttons or list)
   */
  private mapChoiceMessage(message: TypeBotMessage): WhatsAppButtonsMessage | WhatsAppListMessage | null {
    const options = this.extractOptions(message)
    if (!options || options.length === 0) return null

    const text = this.extractText(message) || "Please choose an option:"

    // Use buttons for ≤3 options, list for >3
    if (options.length <= 3) {
      return {
        type: "buttons",
        text: this.applyUrlRewrite(text),
        buttons: options.map((opt) => ({
          id: opt.id,
          label: opt.label.substring(0, 20), // WhatsApp button label limit
        })),
      }
    } else {
      return {
        type: "list",
        text: this.applyUrlRewrite(text),
        title: message.title || "Options",
        buttonText: "Choose",
        sections: [
          {
            title: "Options",
            rows: options.map((opt) => ({
              id: opt.id,
              title: opt.label.substring(0, 24), // WhatsApp list row title limit
              description: opt.label.length > 24 ? opt.label.substring(0, 72) : undefined,
            })),
          },
        ],
      }
    }
  }

  /**
   * Extract options from message
   */
  private extractOptions(message: TypeBotMessage): Array<{ id: string; label: string }> | null {
    const options: Array<{ id: string; label: string }> = []

    // From items array (buttons)
    if (message.items && Array.isArray(message.items)) {
      for (const item of message.items) {
        if (item.id && item.content) {
          options.push({
            id: item.id,
            label: item.content,
          })
        }
      }
    }

    // From options array (lists/polls)
    if (message.options && Array.isArray(message.options)) {
      for (const option of message.options) {
        if (option.id && option.label) {
          options.push({
            id: option.id,
            label: option.label,
          })
        }
      }
    }

    return options.length > 0 ? options : null
  }

  /**
   * Map input message to instruction text
   */
  private mapInputMessage(input: TypeBotInput): WhatsAppTextMessage | null {
    const placeholder = input.options?.labels?.placeholder || this.getDefaultPlaceholder(input.type)
    
    if (!placeholder) return null

    return {
      type: "text",
      text: placeholder,
    }
  }

  /**
   * Get default placeholder for input type
   */
  private getDefaultPlaceholder(type: string): string {
    const placeholders: Record<string, string> = {
      text: "Type your message...",
      number: "Enter a number...",
      email: "Enter your email address...",
      phone: "Enter your phone number...",
      url: "Enter a URL...",
      date: "Enter a date (YYYY-MM-DD)...",
      file: "Please send a file...",
    }

    return placeholders[type] || "Type your response..."
  }

  /**
   * Apply URL rewrite rules
   */
  private applyUrlRewrite(text: string): string {
    if (!this.config.enableUrlRewrite || !this.config.urlRewriteMap) {
      return text
    }

    let result = text
    for (const [pattern, replacement] of Object.entries(this.config.urlRewriteMap)) {
      result = result.replace(new RegExp(pattern, "g"), replacement)
    }

    return result
  }

  /**
   * Update mapper configuration
   */
  updateConfig(config: Partial<MapperConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * Create a message mapper instance
 */
export function createMessageMapper(config?: Partial<MapperConfig>): MessageMapper {
  return new MessageMapper(config)
}
