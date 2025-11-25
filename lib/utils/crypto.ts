// =====================================================
// CRYPTO - Funções de criptografia e segurança
// =====================================================

import { createHmac, randomBytes, createHash } from "crypto"

/**
 * Gera uma API key aleatória
 */
export function generateApiKey(): { key: string; prefix: string } {
  const prefix = "sk_" + randomBytes(4).toString("hex")
  const secret = randomBytes(32).toString("hex")
  return {
    key: `${prefix}_${secret}`,
    prefix,
  }
}

/**
 * Gera hash de uma API key
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

/**
 * Verifica assinatura HMAC do webhook
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex")

  return signature === expectedSignature || signature === `sha256=${expectedSignature}`
}

/**
 * Gera um token JWT manualmente (para ambientes edge)
 */
export function generateJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn = 86400, // 24 horas
): string {
  const header = {
    alg: "HS256",
    typ: "JWT",
  }

  const now = Math.floor(Date.now() / 1000)
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  }

  const base64Header = Buffer.from(JSON.stringify(header)).toString("base64url")
  const base64Payload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url")

  const signature = createHmac("sha256", secret).update(`${base64Header}.${base64Payload}`).digest("base64url")

  return `${base64Header}.${base64Payload}.${signature}`
}

/**
 * Verifica e decodifica um JWT
 */
export function verifyJWT<T>(token: string, secret: string): { valid: boolean; payload?: T; error?: string } {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid token format" }
    }

    const [header, payload, signature] = parts

    // Verifica assinatura
    const expectedSignature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")

    if (signature !== expectedSignature) {
      return { valid: false, error: "Invalid signature" }
    }

    // Decodifica payload
    const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp?: number }

    // Verifica expiração
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: "Token expired" }
    }

    return { valid: true, payload: decodedPayload }
  } catch {
    return { valid: false, error: "Invalid token" }
  }
}

/**
 * Gera hash de senha usando SHA256 (para simplificar sem bcrypt)
 */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex")
}

/**
 * Verifica senha
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}
