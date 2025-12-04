// =====================================================
// TYPEBOT BRIDGE - TypeBot API Client
// =====================================================

import axios, { AxiosInstance } from "axios"

// TypeBot API Response Types
export interface TypeBotMessage {
  id: string
  type: "text" | "image" | "video" | "audio" | "embed" | "choice"
  content?: {
    richText?: Array<{ type: string; children?: Array<{ text: string }> }>
    url?: string
    type?: string
  }
  text?: string
  url?: string
  // For buttons/choices
  items?: Array<{
    id: string
    content?: string
    type?: string
    outgoingEdgeId?: string
  }>
  // Poll/List data
  title?: string
  description?: string
  options?: Array<{
    id: string
    label: string
    value?: string
  }>
}

export interface TypeBotInput {
  id: string
  type: "text" | "number" | "email" | "phone" | "url" | "date" | "choice" | "file"
  options?: {
    labels?: {
      placeholder?: string
      button?: string
    }
    isMultipleChoice?: boolean
  }
}

export interface TypeBotStartResponse {
  sessionId: string
  messages: TypeBotMessage[]
  input?: TypeBotInput
  clientSideActions?: Array<{
    type: string
    [key: string]: unknown
  }>
}

export interface TypeBotContinueResponse {
  messages: TypeBotMessage[]
  input?: TypeBotInput
  clientSideActions?: Array<{
    type: string
    [key: string]: unknown
  }>
}

/**
 * TypeBot API Client
 * Handles communication with TypeBot API for startChat and continueChat
 */
export class TypeBotClient {
  private client: AxiosInstance
  private publicUrl: string
  private token: string

  constructor(publicUrl: string, token?: string) {
    this.publicUrl = publicUrl.replace(/\/$/, "") // Remove trailing slash
    this.token = token || process.env.TYPEBOT_TOKEN || ""

    // Create axios instance
    this.client = axios.create({
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
    })

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error("[TypeBot Client] API Error:", {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        })
        throw error
      }
    )
  }

  /**
   * Start a new chat session with TypeBot
   */
  async startChat(prefilledVariables?: Record<string, string>): Promise<TypeBotStartResponse> {
    try {
      const response = await this.client.post(`${this.publicUrl}/api/v1/typebots/start`, {
        isStreamEnabled: false,
        prefilledVariables: prefilledVariables || {},
      })

      console.log("[TypeBot Client] Start chat response:", {
        sessionId: response.data.sessionId,
        messageCount: response.data.messages?.length || 0,
        hasInput: !!response.data.input,
      })

      return response.data
    } catch (error) {
      console.error("[TypeBot Client] Failed to start chat:", error)
      throw error
    }
  }

  /**
   * Continue an existing chat session
   */
  async continueChat(
    sessionId: string,
    message: string | { type: string; value: string }
  ): Promise<TypeBotContinueResponse> {
    try {
      const payload =
        typeof message === "string"
          ? { message }
          : message

      const response = await this.client.post(
        `${this.publicUrl}/api/v1/sessions/${sessionId}/continueChat`,
        payload
      )

      console.log("[TypeBot Client] Continue chat response:", {
        sessionId,
        messageCount: response.data.messages?.length || 0,
        hasInput: !!response.data.input,
      })

      return response.data
    } catch (error) {
      console.error("[TypeBot Client] Failed to continue chat:", error)
      throw error
    }
  }

  /**
   * Extract text from TypeBot rich text format
   */
  extractTextFromMessage(message: TypeBotMessage): string {
    if (message.text) {
      return message.text
    }

    if (message.content?.richText) {
      // Extract text from rich text format
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
   * Check if message has media
   */
  hasMedia(message: TypeBotMessage): boolean {
    return (
      message.type === "image" ||
      message.type === "video" ||
      message.type === "audio" ||
      (message.type === "embed" && !!message.content?.url)
    )
  }

  /**
   * Get media URL from message
   */
  getMediaUrl(message: TypeBotMessage): string | null {
    if (message.url) {
      return message.url
    }

    if (message.content?.url) {
      return message.content.url
    }

    return null
  }

  /**
   * Get media type from message
   */
  getMediaType(message: TypeBotMessage): "image" | "video" | "audio" | "document" | null {
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
   * Extract options/choices from message
   */
  extractOptions(message: TypeBotMessage): Array<{ id: string; label: string }> | null {
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
}

/**
 * Create a TypeBot client instance
 */
export function createTypeBotClient(publicUrl: string, token?: string): TypeBotClient {
  return new TypeBotClient(publicUrl, token)
}
