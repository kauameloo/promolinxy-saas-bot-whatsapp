// =====================================================
// TYPEBOT BRIDGE - Redis Client for Session Management
// =====================================================

import Redis from "ioredis"

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  maxRetriesPerRequest: 3,
}

// Create Redis client instance
export const redisClient = new Redis(redisConfig)

// Redis event handlers
redisClient.on("connect", () => {
  console.log("[TypeBot Bridge] Redis client connected")
})

redisClient.on("ready", () => {
  console.log("[TypeBot Bridge] Redis client ready")
})

redisClient.on("error", (err) => {
  console.error("[TypeBot Bridge] Redis client error:", err)
})

redisClient.on("close", () => {
  console.log("[TypeBot Bridge] Redis client connection closed")
})

// Session key prefixes
export const REDIS_KEYS = {
  SESSION: (phone: string) => `typebot:session:${phone}`,
  LAST_OPTIONS: (sessionId: string) => `typebot:lastOptions:${sessionId}`,
  LAST_ACTIVITY: (sessionId: string) => `typebot:lastActivity:${sessionId}`,
  STATE: (sessionId: string) => `typebot:state:${sessionId}`,
}

// Default TTL: 72 hours (in seconds)
export const DEFAULT_SESSION_TTL = 72 * 60 * 60

// Session data interface
export interface TypeBotSession {
  sessionId: string
  phone: string
  lastActivityAt: string
  lastUserMessage?: string
  lastOptions?: Record<string, string>
  currentState?: string
  flowUrl?: string
  tenantId?: string
}

// =====================================================
// SESSION MANAGEMENT FUNCTIONS
// =====================================================

/**
 * Get or create a TypeBot session for a phone number
 */
export async function getOrCreateSession(
  phone: string,
  tenantId: string,
  flowUrl: string
): Promise<TypeBotSession> {
  const key = REDIS_KEYS.SESSION(phone)
  const existing = await redisClient.get(key)

  if (existing) {
    const session: TypeBotSession = JSON.parse(existing)
    // Update last activity
    session.lastActivityAt = new Date().toISOString()
    await redisClient.setex(key, DEFAULT_SESSION_TTL, JSON.stringify(session))
    return session
  }

  // Create new session
  const newSession: TypeBotSession = {
    sessionId: `session_${phone}_${Date.now()}`,
    phone,
    lastActivityAt: new Date().toISOString(),
    flowUrl,
    tenantId,
  }

  await redisClient.setex(key, DEFAULT_SESSION_TTL, JSON.stringify(newSession))
  return newSession
}

/**
 * Update session data
 */
export async function updateSession(
  phone: string,
  updates: Partial<TypeBotSession>
): Promise<void> {
  const key = REDIS_KEYS.SESSION(phone)
  const existing = await redisClient.get(key)

  if (!existing) {
    console.warn(`[TypeBot Bridge] Session not found for phone: ${phone}`)
    return
  }

  const session: TypeBotSession = JSON.parse(existing)
  const updated = {
    ...session,
    ...updates,
    lastActivityAt: new Date().toISOString(),
  }

  await redisClient.setex(key, DEFAULT_SESSION_TTL, JSON.stringify(updated))
}

/**
 * Get session by phone number
 */
export async function getSession(phone: string): Promise<TypeBotSession | null> {
  const key = REDIS_KEYS.SESSION(phone)
  const data = await redisClient.get(key)
  return data ? JSON.parse(data) : null
}

/**
 * Delete session
 */
export async function deleteSession(phone: string): Promise<void> {
  const key = REDIS_KEYS.SESSION(phone)
  const session = await getSession(phone)
  
  if (session) {
    // Delete all related keys
    await redisClient.del(key)
    await redisClient.del(REDIS_KEYS.LAST_OPTIONS(session.sessionId))
    await redisClient.del(REDIS_KEYS.LAST_ACTIVITY(session.sessionId))
    await redisClient.del(REDIS_KEYS.STATE(session.sessionId))
  }
}

/**
 * Store last options for a session (for button/list mapping)
 */
export async function storeLastOptions(
  sessionId: string,
  options: Record<string, string>
): Promise<void> {
  const key = REDIS_KEYS.LAST_OPTIONS(sessionId)
  await redisClient.setex(key, DEFAULT_SESSION_TTL, JSON.stringify(options))
}

/**
 * Get last options for a session
 */
export async function getLastOptions(
  sessionId: string
): Promise<Record<string, string> | null> {
  const key = REDIS_KEYS.LAST_OPTIONS(sessionId)
  const data = await redisClient.get(key)
  return data ? JSON.parse(data) : null
}

/**
 * Update last activity timestamp
 */
export async function updateLastActivity(sessionId: string): Promise<void> {
  const key = REDIS_KEYS.LAST_ACTIVITY(sessionId)
  await redisClient.setex(key, DEFAULT_SESSION_TTL, new Date().toISOString())
}

/**
 * Get all active sessions for a tenant
 */
export async function getActiveSessions(tenantId: string): Promise<TypeBotSession[]> {
  const pattern = REDIS_KEYS.SESSION("*")
  const keys = await redisClient.keys(pattern)
  
  const sessions: TypeBotSession[] = []
  for (const key of keys) {
    const data = await redisClient.get(key)
    if (data) {
      const session: TypeBotSession = JSON.parse(data)
      if (session.tenantId === tenantId) {
        sessions.push(session)
      }
    }
  }
  
  return sessions
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  await redisClient.quit()
  console.log("[TypeBot Bridge] Redis connection closed")
}
