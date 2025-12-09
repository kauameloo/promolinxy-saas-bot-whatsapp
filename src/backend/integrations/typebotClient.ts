// =====================================================
// TYPEBOT CLIENT - HTTP Client para comunicação com Typebot
// =====================================================

/**
 * Configuração do cliente Typebot
 */
export interface TypebotConfig {
  baseUrl: string
  apiKey: string
  defaultFlowId: string
}

/**
 * Resposta de mensagem do Typebot
 */
export interface TypebotMessage {
  id: string
  type: "text" | "image" | "video" | "audio" | "file" | "input" | "choice input"
  content?: TypebotTextContent | TypebotMediaContent | TypebotInputContent | TypebotChoiceContent
}

export interface TypebotTextContent {
  type: "richText"
  richText: Array<{
    type: string
    children: Array<{ text: string } | { type: string; url: string; children: Array<{ text: string }> }>
  }>
}

export interface TypebotMediaContent {
  url: string
  type?: string
}

export interface TypebotInputContent {
  placeholder?: string
}

export interface TypebotChoiceContent {
  items: Array<{
    id: string
    content: string
  }>
}

/**
 * Resposta do Typebot após startChat ou continueChat
 */
export interface TypebotResponse {
  sessionId: string
  typebot: {
    id: string
    theme: any
    settings: any
  }
  messages: TypebotMessage[]
  input?: {
    id: string
    type: string
    items?: Array<{ id: string; content: string }> // ← adicionamos isso
    options?: { items: Array<{ id: string; content: string }> }
  }
  clientSideActions?: Array<{
    type: string
    [key: string]: any
  }>
  logs?: string[]
}

/**
 * Mensagem parseada para envio via WhatsApp
 */
export interface ParsedTypebotMessage {
  type: "text" | "image" | "video" | "audio" | "document" | "buttons"
  content: string
  mediaUrl?: string
  buttons?: Array<{ id: string; text: string }>
}

/**
 * Cliente HTTP para comunicação com Typebot
 */
export class TypebotClient {
  private config: TypebotConfig

  constructor(config?: Partial<TypebotConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || process.env.TYPEBOT_BASE_URL || "http://typebot-viewer:3000",
      apiKey: config?.apiKey || process.env.TYPEBOT_API_KEY || "",
      defaultFlowId: config?.defaultFlowId || process.env.TYPEBOT_DEFAULT_FLOW_ID || "",
    }

    if (!this.config.apiKey) {
      console.warn("[TypebotClient] API Key não configurada!")
    }
    if (!this.config.defaultFlowId) {
      console.warn("[TypebotClient] Default Flow ID não configurado!")
    }

    console.log(
      `[TypebotClient] Inicializado - Base URL: ${this.config.baseUrl}, Flow ID: ${this.config.defaultFlowId}`,
    )
  }

  /**
   * Headers padrão para requisições
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    }
  }

  /**
   * Inicia uma nova conversa com o Typebot
   */
  async startChat(flowId?: string, prefilledVariables?: Record<string, string>): Promise<TypebotResponse> {
    const targetFlowId = flowId || this.config.defaultFlowId
    const url = `${this.config.baseUrl}/api/v1/typebots/${targetFlowId}/startChat`

    console.log(`[TypebotClient] Iniciando chat - Flow: ${targetFlowId}`)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          prefilledVariables: prefilledVariables || {},
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[TypebotClient] Erro ao iniciar chat: ${response.status} - ${errorText}`)
        throw new Error(`Typebot startChat failed: ${response.status} - ${errorText}`)
      }

      const data = (await response.json()) as TypebotResponse
      console.log(
        `[TypebotClient] Chat iniciado - Session ID: ${data.sessionId}, Mensagens: ${data.messages?.length || 0}`,
      )

      return data
    } catch (error) {
      console.error("[TypebotClient] Erro ao iniciar chat:", error)
      throw error
    }
  }

  /**
   * Continua uma conversa existente com o Typebot
   */
  async continueChat(sessionId: string, message: string): Promise<TypebotResponse> {
    const url = `${this.config.baseUrl}/api/v1/sessions/${sessionId}/continueChat`

    console.log(`[TypebotClient] Continuando chat - Session: ${sessionId}, Mensagem: ${message.substring(0, 50)}...`)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          message,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[TypebotClient] Erro ao continuar chat: ${response.status} - ${errorText}`)

        // Se a sessão expirou ou não existe, retorna null para criar nova
        if (response.status === 404 || response.status === 400) {
          throw new Error("SESSION_EXPIRED")
        }

        throw new Error(`Typebot continueChat failed: ${response.status} - ${errorText}`)
      }

      const data = (await response.json()) as TypebotResponse
      console.log(`[TypebotClient] Chat continuado - Mensagens: ${data.messages?.length || 0}`)

      return data
    } catch (error) {
      console.error("[TypebotClient] Erro ao continuar chat:", error)
      throw error
    }
  }

  /**
   * Extrai texto de um RichText do Typebot
   */
  private extractTextFromRichText(richText: TypebotTextContent["richText"]): string {
    if (!richText || !Array.isArray(richText)) return ""

    let result = ""
    for (const block of richText) {
      if (block.children) {
        for (const child of block.children) {
          if ("text" in child) {
            result += child.text
          } else if ("url" in child && child.children) {
            // É um link
            const linkText = child.children.map((c) => ("text" in c ? c.text : "")).join("")
            result += `${linkText} (${child.url})`
          }
        }
      }
      result += "\n"
    }
    return result.trim()
  }

  /**
   * Parseia mensagens do Typebot para formato WhatsApp
   */
  parseMessages(response: TypebotResponse): ParsedTypebotMessage[] {
    const parsed: ParsedTypebotMessage[] = []

    if (!response.messages || !Array.isArray(response.messages)) {
      return parsed
    }

    for (const msg of response.messages) {
      try {
        switch (msg.type) {
          case "text":
            if (msg.content && "richText" in msg.content) {
              const text = this.extractTextFromRichText(msg.content.richText)
              if (text) {
                parsed.push({ type: "text", content: text })
              }
            }
            break

          case "image":
            if (msg.content && "url" in msg.content) {
              parsed.push({
                type: "image",
                content: "",
                mediaUrl: msg.content.url,
              })
            }
            break

          case "video":
            if (msg.content && "url" in msg.content) {
              parsed.push({
                type: "video",
                content: "",
                mediaUrl: msg.content.url,
              })
            }
            break

          case "audio":
            if (msg.content && "url" in msg.content) {
              parsed.push({
                type: "audio",
                content: "",
                mediaUrl: msg.content.url,
              })
            }
            break

          case "file":
            if (msg.content && "url" in msg.content) {
              parsed.push({
                type: "document",
                content: "",
                mediaUrl: msg.content.url,
              })
            }
            break

          case "choice input":
            // Options/botões serão tratados separadamente via input
            break

          default:
            console.log(`[TypebotClient] Tipo de mensagem não tratado: ${msg.type}`)
        }
      } catch (error) {
        console.error(`[TypebotClient] Erro ao parsear mensagem:`, error, msg)
      }
    }

    // Tratar input de escolha (botões)
    if (response.input?.type === "choice input") {
      const items =
        response.input.items ??          // ← correto para Typebot moderno
        response.input.options?.items ?? // ← compatibilidade com versões antigas
        []

      if (items.length > 0) {
        const buttons = items.map((item: { id: string; content: string }) => ({
          id: item.id,
          text: item.content,
        }))

        parsed.push({
          type: "buttons",
          content: "",
          buttons,
        })
      }
    }

    return parsed
  }

  /**
   * Obtém a configuração atual
   */
  getConfig(): TypebotConfig {
    return { ...this.config }
  }
}

// Singleton para reutilização
let typebotClientInstance: TypebotClient | null = null

export function getTypebotClient(config?: Partial<TypebotConfig>): TypebotClient {
  if (!typebotClientInstance) {
    typebotClientInstance = new TypebotClient(config)
  }
  return typebotClientInstance
}

export function resetTypebotClient(): void {
  typebotClientInstance = null
}
