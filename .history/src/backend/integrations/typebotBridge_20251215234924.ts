// =====================================================
// TYPEBOT BRIDGE - Ponte entre WhatsApp e Typebot
// =====================================================

import { getTypebotClient, type TypebotClient, type ParsedTypebotMessage, type TypebotResponse } from "./typebotClient"
import { getRedisSessionManager, type RedisSessionManager, type TypebotSessionData } from "./redisSession"
import { sendZenderButtons } from "./zender"
import type { WhatsAppEngine } from "../lib/whatsapp-engine"
import type { SendMessageResult } from "../lib/types"

/**
 * Configuração do Typebot Bridge
 */
export interface TypebotBridgeConfig {
  maxButtonsForNativeButtons: number
  messageDelayMs: number
  enableLogging: boolean
  fallbackMessage: string
  errorMessage: string
}

const DEFAULT_BRIDGE_CONFIG: TypebotBridgeConfig = {
  maxButtonsForNativeButtons: 3,
  messageDelayMs: 1000,
  enableLogging: true,
  fallbackMessage: "Desculpe, não entendi sua resposta. Por favor, tente novamente.",
  errorMessage: "Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente em alguns instantes.",
}

/**
 * Resultado do processamento de mensagem
 */
export interface BridgeProcessResult {
  success: boolean
  messagesSent: number
  errors: string[]
  sessionId?: string
  isNewSession: boolean
}

/**
 * Ponte entre WhatsApp e Typebot
 * Responsável por:
 * - Receber mensagens do WhatsApp
 * - Gerenciar sessões via Redis
 * - Comunicar com Typebot
 * - Enviar respostas via WhatsApp
 */
export class TypebotBridge {
  private typebotClient: TypebotClient
  private redisSession: RedisSessionManager
  private config: TypebotBridgeConfig
  private buttonMappings: Map<string, Map<string, string>> = new Map() // phone -> (buttonText -> buttonId)

  constructor(config?: Partial<TypebotBridgeConfig>) {
    this.typebotClient = getTypebotClient()
    this.redisSession = getRedisSessionManager()
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config }

    console.log("[TypebotBridge] Inicializado")
  }

  /**
   * Inicializa as conexões necessárias
   */
  async initialize(): Promise<void> {
    try {
      await this.redisSession.connect()

      // 🔥 Reset total ao subir o serviço
      await this.redisSession.clearAllSessions()
      console.log("[TypebotBridge] Todas as sessões foram resetadas no startup")

      console.log("[TypebotBridge] Conexões inicializadas")
    } catch (error) {
      console.error("[TypebotBridge] Erro ao inicializar:", error)
      throw error
    }
  }

/**
 * Simula "digitando..." antes de enviar mensagens
 */
private async simulateTyping(engine: WhatsAppEngine, chatId: string, text: string): Promise<void> {
  try {
    // O método simulateTyping do engine já resolve o chatId sozinho
    await engine.simulateTyping(chatId, text);

    // tempo proporcional ao tamanho
    const typingTime = Math.min(3000, 500 + text.length * 30);
    await new Promise((resolve) => setTimeout(resolve, typingTime));

  } catch (err) {
    console.error("[TypingSimulation] Erro ao simular digitando:", err);
  }
}




  /**
   * Processa uma mensagem recebida do WhatsApp
   */
  async processIncomingMessage(
    engine: WhatsAppEngine,
    phone: string,
    messageBody: string,
    flowId?: string,
  ): Promise<BridgeProcessResult> {
    const result: BridgeProcessResult = {
      success: false,
      messagesSent: 0,
      errors: [],
      isNewSession: false,
    }

    try {
      this.log(`Processando mensagem de ${phone}: ${messageBody.substring(0, 50)}...`)

      // Normaliza o telefone e registra a origem
      const normalizedPhone = this.normalizePhone(phone)
      this.log(`[Bridge] Origem phone='${phone}' → normalizado='${normalizedPhone}'`)

      // Sinaliza quando origem vier como LID para facilitar diagnóstico
      try {
        if (String(phone).endsWith("@lid")) {
          this.log(`[Bridge] Origem era @lid; usando dígitos '${normalizedPhone}' e forçando envio via @c.us`)
        }
      } catch {}

      // Resolve o input do usuário (pode ser número para botão)
      const resolvedMessage = this.resolveButtonInput(normalizedPhone, messageBody)

      // Verifica se existe sessão no Redis
      const existingSession = await this.redisSession.getSession(normalizedPhone)

      // 🔥 Se a sessão terminou no Typebot → modo humano
if (existingSession?.finished) {
  this.log(`Sessão finalizada para ${normalizedPhone} → mensagens não vão mais para o Typebot.`)

  // Aqui você pode futuramente enviar para um painel humano
  await this.redisSession.saveSession(normalizedPhone, {
    ...existingSession,
    lastUsedAt: new Date().toISOString(),
  })

  return {
    success: true,
    messagesSent: 0,
    errors: [],
    isNewSession: false,
    sessionId: existingSession.sessionId,
  }
}


      
      let typebotResponse: TypebotResponse

// 🔥 EXPIRAÇÃO INTELIGENTE DE SESSÃO (ex: 30 minutos sem falar = nova sessão)
if (existingSession) {
  const last = new Date(existingSession.lastUsedAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - last) / 1000 / 60;

  if (diffMinutes > 30) {
    this.log(`Sessão antiga detectada (${diffMinutes.toFixed(1)} min). Iniciando nova sessão.`);

    // Apaga sessão antiga
    await this.redisSession.deleteSession(normalizedPhone);

    // Inicia nova sessão
    const newSession = await this.startNewSession(normalizedPhone, flowId);

    result.isNewSession = true;
    result.sessionId = newSession.sessionId;

    await this.redisSession.saveSession(normalizedPhone, {
      sessionId: newSession.sessionId,
      flowId: flowId || this.typebotClient.getConfig().defaultFlowId,
      lastUsedAt: new Date().toISOString(),
      phoneNumber: normalizedPhone,
    });

    typebotResponse = newSession;

    // IMPORTANTE: ir direto para envio de mensagens
    const parsedMessages = this.typebotClient.parseMessages(typebotResponse);
    for (const msg of parsedMessages) {
      await this.sendTypebotMessageToWhatsApp(engine, normalizedPhone, msg);
    }

    return {
      success: true,
      messagesSent: parsedMessages.length,
      errors: [],
      isNewSession: true,
      sessionId: newSession.sessionId,
    };
  }
}


      if (existingSession) {
        // Sessão existente - continua chat
        this.log(`Continuando sessão existente: ${existingSession.sessionId}`)
        result.sessionId = existingSession.sessionId

        try {
          typebotResponse = await this.typebotClient.continueChat(existingSession.sessionId, resolvedMessage)
} catch (error) {
  // ❗ Detecta fim de fluxo baseado na destruição da sessão pelo Typebot
  if (error instanceof Error && error.message === "SESSION_EXPIRED") {
    const persisted = await this.redisSession.getSession(normalizedPhone);

    // Se tínhamos uma sessão e ela morre sem finished=true, então o fluxo acabou
    if (persisted && !persisted.finished) {
      this.log(`[TypebotBridge] Sessão finalizada automaticamente pelo Typebot. Marcando como finished.`);

      await this.redisSession.saveSession(normalizedPhone, {
        ...persisted,
        finished: true,
        lastUsedAt: new Date().toISOString(),
      });

      return {
        success: true,
        messagesSent: 0,
        errors: [],
        isNewSession: false,
        sessionId: persisted.sessionId,
      };
    }

    // Se já estava finished, apenas ignora
    if (persisted?.finished) {
      this.log(`[TypebotBridge] Mensagem recebida após fluxo finalizado. Ignorando Typebot.`);
      return {
        success: true,
        messagesSent: 0,
        errors: [],
        isNewSession: false,
        sessionId: persisted.sessionId,
      };
    }

    // Caso contrário, session expirou antes do fim → inicia nova
    this.log(`Sessão expirou no Typebot antes do fim. Iniciando nova sessão...`);
    await this.redisSession.deleteSession(normalizedPhone);

    typebotResponse = await this.startNewSession(normalizedPhone, flowId);
    result.isNewSession = true;
    result.sessionId = typebotResponse.sessionId;
  } else {
    throw error;
  }
}

      } else {
        // Nova sessão - inicia chat
        this.log(`Iniciando nova sessão para ${normalizedPhone}`)
        typebotResponse = await this.startNewSession(normalizedPhone, flowId)
        result.isNewSession = true
        result.sessionId = typebotResponse.sessionId
      }

      // Salva/atualiza sessão no Redis
// Salva/atualiza sessão no Redis
if (typebotResponse.sessionId) {
  // Apenas startChat retorna sessionId
  await this.redisSession.saveSession(normalizedPhone, {
    sessionId: typebotResponse.sessionId,
    flowId: flowId || this.typebotClient.getConfig().defaultFlowId,
    lastUsedAt: new Date().toISOString(),
    phoneNumber: normalizedPhone,
  })
  this.log(`[RedisSession] Sessão atualizada: ${typebotResponse.sessionId}`)
} else {
  // continueChat NÃO retorna sessionId → manter sessão atual
  const existing = await this.redisSession.getSession(normalizedPhone)
  if (existing?.sessionId) {
    this.log(`[RedisSession] Mantendo sessão atual: ${existing.sessionId}`)
    await this.redisSession.saveSession(normalizedPhone, {
      ...existing,
      lastUsedAt: new Date().toISOString(),
    })
  } else {
    // Isso só acontece em erro, então forçamos nova sessão
    this.log(`[RedisSession] Nenhuma sessão encontrada, forçando nova sessão`)
    const newSession = await this.startNewSession(normalizedPhone, flowId)
    await this.redisSession.saveSession(normalizedPhone, {
      sessionId: newSession.sessionId,
      flowId: flowId || this.typebotClient.getConfig().defaultFlowId,
      lastUsedAt: new Date().toISOString(),
      phoneNumber: normalizedPhone,
    })
  }
}

if (typebotResponse.variables && typebotResponse.variables.finished === true) {
  this.log(`Fluxo finalizado para ${normalizedPhone}. Marcando sessão como encerrada.`)

  const current = await this.redisSession.getSession(normalizedPhone)

  if (current && current.sessionId) {
    await this.redisSession.saveSession(normalizedPhone, {
      sessionId: current.sessionId,
      flowId: current.flowId,
      phoneNumber: current.phoneNumber,
      lastUsedAt: new Date().toISOString(),
      finished: true,   // ← AQUI! MARCA COMO FINALIZADO
    })
  }
}


      // Parseia e envia as mensagens
      const parsedMessages = this.typebotClient.parseMessages(typebotResponse)


      this.log(`Mensagens a enviar: ${parsedMessages.length}`)

      for (const msg of parsedMessages) {
        try {
          const sendResult = await this.sendTypebotMessageToWhatsApp(engine, normalizedPhone, msg)
          if (sendResult.success) {
            result.messagesSent++
          } else {
            result.errors.push(sendResult.error || "Erro desconhecido ao enviar mensagem")
          }

          // Delay entre mensagens para evitar flood
          if (this.config.messageDelayMs > 0) {
            await this.delay(this.config.messageDelayMs)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Erro ao enviar mensagem"
          result.errors.push(errorMsg)
          console.error("[TypebotBridge] Erro ao enviar mensagem:", error)
        }
      }

      result.success = result.errors.length === 0

      this.log(`Processamento concluído: ${result.messagesSent} mensagens enviadas, ${result.errors.length} erros`)
      return result
    } catch (error) {
      console.error("[TypebotBridge] Erro ao processar mensagem:", error)
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido")

      // Envia mensagem de erro amigável
      try {
        await engine.sendMessage({
          to: phone,
          content: this.config.errorMessage,
        })
      } catch (sendError) {
        console.error("[TypebotBridge] Erro ao enviar mensagem de erro:", sendError)
      }

      return result
    }
  }

  /**
   * Inicia uma nova sessão no Typebot
   */
  private async startNewSession(phone: string, flowId?: string): Promise<TypebotResponse> {
    const prefilledVariables = {
      whatsappPhone: phone,
      userPhone: phone,
    }

    return await this.typebotClient.startChat(flowId, prefilledVariables)
  }

  /**
   * Envia uma mensagem parseada do Typebot para o WhatsApp
   */
  private async sendTypebotMessageToWhatsApp(
    engine: WhatsAppEngine,
    phone: string,
    message: ParsedTypebotMessage,
  ): Promise<SendMessageResult> {
    // Sempre preferir formato clássico @c.us para evitar misrouting via LID
    const chatId = phone.includes("@") ? phone : `${phone}@c.us`
    this.log(`[Bridge] Enviando para chatId='${chatId}' (phone='${phone}')`)

    switch (message.type) {
      case "text":
        if (message.content) {
          await this.simulateTyping(engine, chatId, message.content)
        }

        return await engine.sendMessage({
          to: chatId,
          content: message.content,
        })


      case "image":
      case "video":
      case "audio":
      case "document":
        if (message.mediaUrl) {
          return await engine.sendMediaMessage({
            to: chatId,
            content: message.content || "",
            mediaUrl: message.mediaUrl,
            mediaType: message.type === "document" ? "document" : message.type,
          })
        }
        return { success: false, error: "URL de mídia não fornecida" }

      case "buttons":
        return await this.sendButtonsMessage(engine, phone, message)

      default:
        return { success: false, error: `Tipo de mensagem não suportado: ${message.type}` }
    }
  }

  /**
   * Envia mensagem com botões/opções
   */
  private async sendButtonsMessage(
    engine: WhatsAppEngine,
    phone: string,
    message: ParsedTypebotMessage,
  ): Promise<SendMessageResult> {
    if (!message.buttons || message.buttons.length === 0) {
      return { success: false, error: "Nenhum botão fornecido" }
    }

  const chatId = phone.includes("@") ? phone : `${phone}@c.us`
  this.log(`[Bridge] Enviando botões para chatId='${chatId}' (phone='${phone}')`)
    const normalizedPhone = this.normalizePhone(phone)

    // Limpa mapeamentos anteriores para este telefone
    this.buttonMappings.delete(normalizedPhone)

    if (process.env.ZENDER_TOKEN) {
      try {
        this.log(`Tentando enviar botões via Zender para ${normalizedPhone}`)

        await this.simulateTyping(engine, chatId, message.content || "...")
        
        const zenderResult = await sendZenderButtons({
          to: normalizedPhone,
          message: message.content || "Escolha uma opção:",
          buttons: message.buttons,
          session: process.env.ZENDER_SESSION || "default",
        })

        if (zenderResult.success) {
          this.log(`Botões enviados via Zender com sucesso: ${zenderResult.messageId}`)
          // Salva mapeamento de texto -> id para quando usuário clicar
          this.saveButtonMapping(normalizedPhone, message.buttons)
          return { success: true, messageId: zenderResult.messageId }
        } else {
          this.log(`Zender falhou: ${JSON.stringify(zenderResult.error)}, usando fallback...`)
        }
      } catch (error) {
        console.error("[TypebotBridge] Erro ao enviar via Zender:", error)
        this.log(`Erro no Zender, usando fallback lista numerada`)
      }
    } else {
      this.log(`ZENDER_TOKEN não configurado, usando lista numerada`)
    }

    return await this.sendNumberedList(engine, chatId, normalizedPhone, message.buttons)
  }

  /**
   * Envia opções como lista numerada
   */
  private async sendNumberedList(
    engine: WhatsAppEngine,
    chatId: string,
    phone: string,
    buttons: Array<{ id: string; text: string }>,
  ): Promise<SendMessageResult> {
    // Constrói a lista numerada
    let listText = "Escolha uma opção:\n\n"

    buttons.forEach((btn, index) => {
      listText += `${index + 1}) ${btn.text}\n`
    })

    listText += "\n_Responda com o número ou texto da opção desejada._"

    // Salva mapeamento de número/texto -> id
    const mapping = new Map<string, string>()
    buttons.forEach((btn, index) => {
      mapping.set(String(index + 1), btn.id)
      mapping.set(btn.text.toLowerCase().trim(), btn.id)
    })
    this.buttonMappings.set(phone, mapping)

    return await engine.sendMessage({
      to: chatId,
      content: listText,
    })
  }

  /**
   * Salva mapeamento de botões para um telefone
   */
  private saveButtonMapping(phone: string, buttons: Array<{ id: string; text: string }>): void {
    const mapping = new Map<string, string>()
    buttons.forEach((btn, index) => {
      mapping.set(String(index + 1), btn.id)
      mapping.set(btn.text.toLowerCase().trim(), btn.id)
    })
    this.buttonMappings.set(phone, mapping)
  }

  /**
   * Resolve input do usuário (número ou texto) para ID do botão
   */
private resolveButtonInput(phone: string, input: string): string {
  const mapping = this.buttonMappings.get(phone)
  if (!mapping) return input

  const normalized = input.toLowerCase().trim()

  const id = mapping.get(normalized) || mapping.get(input)
  if (id) {
    this.log(`Input resolvido para ID: ${id}`)
    this.buttonMappings.delete(phone)
    return id
  }

  return input
}


  /**
   * Normaliza número de telefone
   */
  private normalizePhone(phone: string): string {
    // Remove sufixo @c.us ou @s.whatsapp.net
    let normalized = phone.replace(/@.*$/, "")
    // Remove caracteres não numéricos
    normalized = normalized.replace(/\D/g, "")
    return normalized
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Log helper
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[TypebotBridge] ${message}`)
    }
  }

  /**
   * Reseta a sessão de um usuário
   */
  async resetSession(phone: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(phone)
    this.buttonMappings.delete(normalizedPhone)
    return await this.redisSession.deleteSession(normalizedPhone)
  }

  /**
   * Obtém informações da sessão de um usuário
   */
  async getSessionInfo(phone: string): Promise<TypebotSessionData | null> {
    const normalizedPhone = this.normalizePhone(phone)
    return await this.redisSession.getSession(normalizedPhone)
  }

  /**
   * Lista todas as sessões ativas
   */
  async listActiveSessions(): Promise<string[]> {
    return await this.redisSession.listAllSessions()
  }
}

// Singleton para reutilização
let typebotBridgeInstance: TypebotBridge | null = null

export function getTypebotBridge(config?: Partial<TypebotBridgeConfig>): TypebotBridge {
  if (!typebotBridgeInstance) {
    typebotBridgeInstance = new TypebotBridge(config)
  }
  return typebotBridgeInstance
}

export async function initializeTypebotBridge(): Promise<TypebotBridge> {
  const bridge = getTypebotBridge()
  await bridge.initialize()
  return bridge
}

export function resetTypebotBridge(): void {
  typebotBridgeInstance = null
}
