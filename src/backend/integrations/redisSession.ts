// =====================================================
// REDIS SESSION - Gerenciamento de sessões Typebot via Redis
// =====================================================

import { createClient, type RedisClientType } from "redis"

/**
 * Dados da sessão Typebot armazenada no Redis
 */
export interface TypebotSessionData {
  sessionId: string
  flowId: string
  lastUsedAt: string
  phoneNumber: string
  metadata?: Record<string, unknown>
  finished?: boolean
}

/**
 * Configuração do Redis Session Manager
 */
export interface RedisSessionConfig {
  redisUrl: string
  sessionTtlHours: number
  keyPrefix: string
}

const DEFAULT_CONFIG: RedisSessionConfig = {
  redisUrl: process.env.REDIS_URL || "redis://redis:6379",
  sessionTtlHours: Number.parseInt(process.env.TYPEBOT_SESSION_TTL_HOURS || "72", 10),
  keyPrefix: "typebot:session:",
}

/**
 * Gerenciador de sessões Typebot no Redis
 */
export class RedisSessionManager {
  private client: RedisClientType | null = null
  private config: RedisSessionConfig
  private isConnected = false

  constructor(config?: Partial<RedisSessionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    console.log(`[RedisSession] Configurado - URL: ${this.config.redisUrl}, TTL: ${this.config.sessionTtlHours}h`)
  }

  /**
   * Conecta ao Redis
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return
    }

    try {
      this.client = createClient({
        url: this.config.redisUrl,
      })

      this.client.on("error", (err) => {
        console.error("[RedisSession] Erro de conexão:", err)
        this.isConnected = false
      })

      this.client.on("connect", () => {
        console.log("[RedisSession] Conectado ao Redis")
        this.isConnected = true
      })

      this.client.on("disconnect", () => {
        console.log("[RedisSession] Desconectado do Redis")
        this.isConnected = false
      })

      await this.client.connect()
      this.isConnected = true
    } catch (error) {
      console.error("[RedisSession] Falha ao conectar:", error)
      throw error
    }
  }

  /**
   * Garante que está conectado
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected || !this.client) {
      await this.connect()
    }
  }

  /**
   * Gera a chave Redis para um telefone
   */
  private getKey(phone: string): string {
    // Normaliza o telefone removendo caracteres especiais
    const normalizedPhone = phone.replace(/\D/g, "").replace(/@.*$/, "")
    return `${this.config.keyPrefix}${normalizedPhone}`
  }

  /**
   * Obtém uma sessão existente
   */
  async getSession(phone: string): Promise<TypebotSessionData | null> {
    await this.ensureConnected()

    const key = this.getKey(phone)
    try {
      const data = await this.client!.get(key)

      if (!data) {
        console.log(`[RedisSession] Sessão não encontrada para ${phone}`)
        return null
      }

      const session = JSON.parse(data) as TypebotSessionData
      console.log(`[RedisSession] Sessão encontrada para ${phone}: ${session.sessionId}`)

      // Atualiza o lastUsedAt e renova o TTL
      session.lastUsedAt = new Date().toISOString()
      await this.saveSession(phone, session)

      return session
    } catch (error) {
      console.error(`[RedisSession] Erro ao obter sessão para ${phone}:`, error)
      return null
    }
  }

  /**
   * Salva/atualiza uma sessão
   */
  async saveSession(phone: string, session: TypebotSessionData): Promise<void> {
    await this.ensureConnected()

    const key = this.getKey(phone)
    const ttlSeconds = this.config.sessionTtlHours * 60 * 60

    try {
      session.lastUsedAt = new Date().toISOString()
      session.phoneNumber = phone.replace(/\D/g, "").replace(/@.*$/, "")

      await this.client!.setEx(key, ttlSeconds, JSON.stringify(session))
      console.log(
        `[RedisSession] Sessão salva para ${phone}: ${session.sessionId} (TTL: ${this.config.sessionTtlHours}h)`,
      )
    } catch (error) {
      console.error(`[RedisSession] Erro ao salvar sessão para ${phone}:`, error)
      throw error
    }
  }

  /**
   * Remove uma sessão (reset)
   */
  async deleteSession(phone: string): Promise<boolean> {
    await this.ensureConnected()

    const key = this.getKey(phone)
    try {
      const result = await this.client!.del(key)
      console.log(`[RedisSession] Sessão removida para ${phone}: ${result > 0 ? "sucesso" : "não existia"}`)
      return result > 0
    } catch (error) {
      console.error(`[RedisSession] Erro ao remover sessão para ${phone}:`, error)
      return false
    }
  }

  /**
   * Verifica se uma sessão existe
   */
  async hasSession(phone: string): Promise<boolean> {
    await this.ensureConnected()

    const key = this.getKey(phone)
    try {
      const exists = await this.client!.exists(key)
      return exists > 0
    } catch (error) {
      console.error(`[RedisSession] Erro ao verificar sessão para ${phone}:`, error)
      return false
    }
  }

  /**
   * Lista todas as sessões ativas (para debug)
   */
  async listAllSessions(): Promise<string[]> {
    await this.ensureConnected()

    try {
      const keys = await this.client!.keys(`${this.config.keyPrefix}*`)
      return keys
    } catch (error) {
      console.error("[RedisSession] Erro ao listar sessões:", error)
      return []
    }
  }

  /**
   * Obtém TTL restante de uma sessão (em segundos)
   */
  async getSessionTtl(phone: string): Promise<number> {
    await this.ensureConnected()

    const key = this.getKey(phone)
    try {
      const ttl = await this.client!.ttl(key)
      return ttl
    } catch (error) {
      console.error(`[RedisSession] Erro ao obter TTL para ${phone}:`, error)
      return -1
    }
  }

  /**
   * Remove TODAS as sessões do Typebot no Redis
   */
  async clearAllSessions(): Promise<void> {
    await this.ensureConnected()

    try {
      const keys = await this.client!.keys(`${this.config.keyPrefix}*`)
      if (keys.length > 0) {
        await this.client!.del(keys)
        console.log(`[RedisSession] Todas as sessões foram resetadas (${keys.length} removidas)`)
      } else {
        console.log("[RedisSession] Nenhuma sessão para limpar")
      }
    } catch (error) {
      console.error("[RedisSession] Erro ao limpar todas as sessões:", error)
    }
  }


  /**
   * Fecha a conexão com o Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect()
      this.isConnected = false
      console.log("[RedisSession] Desconectado do Redis")
    }
  }

  /**
   * Verifica se está conectado
   */
  isRedisConnected(): boolean {
    return this.isConnected
  }
}

// Singleton para reutilização
let redisSessionInstance: RedisSessionManager | null = null

export function getRedisSessionManager(config?: Partial<RedisSessionConfig>): RedisSessionManager {
  if (!redisSessionInstance) {
    redisSessionInstance = new RedisSessionManager(config)
  }
  return redisSessionInstance
}

export async function resetRedisSession(phone: string): Promise<boolean> {
  const manager = getRedisSessionManager()
  return await manager.deleteSession(phone)
}


export async function disconnectRedis(): Promise<void> {
  if (redisSessionInstance) {
    await redisSessionInstance.disconnect()
    redisSessionInstance = null
  }
}
