// =====================================================
// WHATSAPP ENGINE - Abstração para whatsapp-web.js
// =====================================================

import type { WhatsAppMessage, WhatsAppSessionInfo, WhatsAppEventHandlers, SendMessageResult } from "./types"

// Import whatsapp-web.js
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js"
import * as qrcode from "qrcode-terminal"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"

/**
 * Directory name used by whatsapp-web.js LocalAuth strategy
 * This is a library convention and should be kept in sync with whatsapp-web.js
 */
const WWEBJS_AUTH_DIR = ".wwebjs_auth"

/**
 * Chromium lock file names that may be left by crashed processes
 * These files prevent new browser instances from starting if not cleaned up properly
 */
const CHROMIUM_LOCK_FILES = ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"]

/**
 * Additional lock file patterns to check
 */
const LOCK_FILE_EXTENSIONS = [".lock"]

/**
 * Session persistence configuration
 * Implements best practices from leading SaaS platforms (Z-API, Take Blip, etc.)
 */
interface SessionPersistenceConfig {
  /** Base path for storing session data */
  dataPath: string
  /** Whether to backup session data for recovery */
  enableBackup: boolean
  /** Encryption key for sensitive session data (optional) */
  encryptionKey?: string
  /** Auto-reconnect on disconnect */
  autoReconnect: boolean
  /** Max reconnection attempts */
  maxReconnectAttempts: number
  /** Delay between reconnection attempts (ms) */
  reconnectDelay: number
}

const DEFAULT_PERSISTENCE_CONFIG: SessionPersistenceConfig = {
  dataPath: process.env.WHATSAPP_SESSION_PATH || "./sessions",
  enableBackup: true,
  encryptionKey: process.env.WHATSAPP_SESSION_ENCRYPTION_KEY,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 5000,
}

// =====================================================
// SESSION UTILITY FUNCTIONS
// =====================================================

function deepCleanChromiumLocks(baseDir: string) {
  const patterns = [
    "SingletonLock",
    "SingletonCookie",
    "SingletonSocket",
    "Singleton*",
    "LOCK",
    "*.lock",
    "*.LOCK",
    "lockfile",
    "LOCKFILE",
  ];

  function deleteIfMatch(fullPath: string, name: string) {
    for (const pattern of patterns) {
      const regex = new RegExp("^" + pattern.replace("*", ".*") + "$", "i");
      if (regex.test(name)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`[WhatsAppEngine] Deleted lock: ${fullPath}`);
        } catch (e) {
          console.warn(`[WhatsAppEngine] Could not delete lock: ${fullPath}`, e);
        }
        return;
      }
    }
  }

  function recurse(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        recurse(full);
      } else {
        deleteIfMatch(full, entry.name);
      }
    }
  }

  recurse(baseDir);
}



/**
 * Gets the session-specific directory path
 */
function getSessionDir(dataPath: string, sessionId: string): string {
  return path.join(dataPath, `session-${sessionId}`)
}

/**
 * Gets the path to the session metadata file
 */
function getMetadataPath(dataPath: string, sessionId: string): string {
  return path.join(getSessionDir(dataPath, sessionId), "session-metadata.json")
}

/**
 * Gets the LocalAuth directory path for a session/clientId
 */
function getAuthDir(dataPath: string, sessionId: string): string {
  return path.join(dataPath, WWEBJS_AUTH_DIR, `session-${sessionId}`)
}

/**
 * Removes Chromium profile lock files that may have been left by a crashed process
 * This resolves the "profile appears to be in use by another Chromium process" error
 *
 * Recursively searches all subdirectories to ensure complete cleanup
 */
function removeChromiumLockFiles(authDir: string): void {
  if (!fs.existsSync(authDir)) {
    return
  }

  /**
   * Recursively remove lock files from a directory and all subdirectories
   */
  function removeLockFilesRecursively(dir: string): void {
    try {
      if (!fs.existsSync(dir)) return

      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // Recursively process subdirectories
          removeLockFilesRecursively(fullPath)
        } else if (entry.isFile()) {
          // Check if this is a lock file
          const isLockFile =
            CHROMIUM_LOCK_FILES.includes(entry.name) || LOCK_FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))

          if (isLockFile) {
            try {
              fs.unlinkSync(fullPath)
              console.log(`[WhatsApp Engine] Removed stale lock file: ${fullPath}`)
            } catch (e) {
              console.warn(`[WhatsApp Engine] Could not remove lock file ${fullPath}:`, e)
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[WhatsApp Engine] Error scanning directory ${dir} for lock files:`, error)
    }
  }

  // Remove lock files recursively from the entire auth directory
  removeLockFilesRecursively(authDir)
}

/**
 * Checks if a valid session exists for restoration (static check)
 */
function checkSessionExists(dataPath: string, sessionId: string): boolean {
  const authDir = getAuthDir(dataPath, sessionId)
  const metadataPath = getMetadataPath(dataPath, sessionId)

  // Check if LocalAuth session directory exists
  const localAuthExists = fs.existsSync(authDir)
  const metadataExists = fs.existsSync(metadataPath)

  return localAuthExists || metadataExists
}

/**
 * Loads session metadata from file (static utility)
 */
function loadMetadataFromFile(
  dataPath: string,
  sessionId: string,
  encryptionKey?: string,
): { phoneNumber?: string; lastConnected?: string } | null {
  try {
    const metadataPath = getMetadataPath(dataPath, sessionId)
    if (!fs.existsSync(metadataPath)) return null

    const encryptedData = fs.readFileSync(metadataPath, "utf8")

    // Decrypt if encryption key is provided
    let data = encryptedData
    if (encryptionKey) {
      const encryption = new SessionEncryption(encryptionKey)
      data = encryption.decrypt(encryptedData)
    }

    return JSON.parse(data)
  } catch (error) {
    console.error(`[WhatsApp Engine] Error loading session metadata for ${sessionId}:`, error)
    return null
  }
}

/**
 * Simple encryption utilities for session data
 * Uses AES-256-GCM for secure encryption
 */
class SessionEncryption {
  private key: Buffer | null = null

  constructor(encryptionKey?: string) {
    if (encryptionKey) {
      // Derive a 32-byte key from the provided key using SHA-256
      this.key = crypto.createHash("sha256").update(encryptionKey).digest()
    }
  }

  encrypt(data: string): string {
    if (!this.key) return data

    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv)
    let encrypted = cipher.update(data, "utf8", "hex")
    encrypted += cipher.final("hex")
    const authTag = cipher.getAuthTag()

    // Format: iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
  }

  decrypt(encryptedData: string): string {
    if (!this.key) return encryptedData

    const parts = encryptedData.split(":")
    if (parts.length !== 3) return encryptedData // Not encrypted

    const [ivHex, authTagHex, data] = parts
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")

    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(data, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  }
}

/**
 * WhatsApp Engine abstraction layer
 *
 * Esta classe fornece uma interface para o whatsapp-web.js
 * Em produção, integra com a biblioteca whatsapp-web.js real
 *
 * Session Persistence Features:
 * - LocalAuth with per-tenant clientId for proper session isolation
 * - Session data backup to JSON for recovery
 * - Optional encryption for sensitive session data
 * - Auto-reconnection with exponential backoff
 * - Health checks and session state monitoring
 */
export class WhatsAppEngine {
  private sessionId: string
  private handlers: WhatsAppEventHandlers
  private status: WhatsAppSessionInfo["status"] = "disconnected"
  private qrCode: string | null = null
  private phoneNumber: string | null = null
  private client: Client | null = null
  private persistenceConfig: SessionPersistenceConfig
  private encryption: SessionEncryption
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private lastHeartbeat: Date | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isInitializing = false
  /** Cached client config built from env and defaults */
  private clientConfig: any | null = null
  /** Last inbound classic chat digits observed for this session (e.g., 55119...) */
  private lastInboundDigits: string | null = null

  /**
   * Build whatsapp-web.js Client configuration with robust Puppeteer flags for Docker/Chromium
   */
  private getClientConfig(): any {
    if (this.clientConfig) return this.clientConfig

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium"
    // Allow overriding args via env, else use proven defaults for containers
    const envArgs = (process.env.PUPPETEER_ARGS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    const defaultArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--disable-accelerated-2d-canvas",
      "--window-size=1920,1080",
    ]

    const puppeteerOptions = {
      executablePath,
      headless: true,
      args: Array.from(new Set([...(envArgs.length ? envArgs : defaultArgs)])),
      // Increase launch timeout to accommodate slow container startups
      timeout: Number.parseInt(process.env.PUPPETEER_LAUNCH_TIMEOUT || "60000", 10),
    }

    const dataPath = this.persistenceConfig?.dataPath || process.env.WHATSAPP_SESSION_PATH || "./sessions"

    // Defer require to runtime to avoid build-time issues
    const wwebjs = require("whatsapp-web.js")

    this.clientConfig = {
      puppeteer: puppeteerOptions,
      authStrategy: new wwebjs.LocalAuth({
        dataPath,
        clientId: this.sessionId ? `session-${this.sessionId}` : undefined,
      }),
      takeoverOnConflict: true,
      takeoverTimeoutMs: Number.parseInt(process.env.WHATSAPP_TAKEOVER_TIMEOUT_MS || "60000", 10),
      qrMaxRetries: Number.parseInt(process.env.WHATSAPP_QR_MAX_RETRIES || "3", 10),
    }

    return this.clientConfig
  }

  /**
   * Initialize the underlying WhatsApp client if not already created.
   * This method should be invoked by the connect flow.
   */
  private ensureClientInitialized(): void {
    if (this.client) return
    const cfg = this.getClientConfig()
    const { Client } = require("whatsapp-web.js")
    this.client = new Client(cfg)
  }

  constructor(sessionId: string, handlers: WhatsAppEventHandlers = {}, config?: Partial<SessionPersistenceConfig>) {
    this.sessionId = sessionId
    this.handlers = handlers
    this.persistenceConfig = { ...DEFAULT_PERSISTENCE_CONFIG, ...config }
    this.encryption = new SessionEncryption(this.persistenceConfig.encryptionKey)

    // Ensure session directory exists
    this.ensureSessionDirectory()
  }

  /**
   * Ensures the session directory exists
   */
  private ensureSessionDirectory(): void {
    const sessionDir = getSessionDir(this.persistenceConfig.dataPath, this.sessionId)
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
      console.log(`[WhatsApp Engine] Created session directory: ${sessionDir}`)
    }
  }

  /**
   * Saves session metadata for recovery
   */
  private saveSessionMetadata(): void {
    if (!this.persistenceConfig.enableBackup) return

    try {
      const metadata = {
        sessionId: this.sessionId,
        phoneNumber: this.phoneNumber,
        status: this.status,
        lastConnected: new Date().toISOString(),
        lastHeartbeat: this.lastHeartbeat?.toISOString(),
        version: "1.0",
      }

      const data = JSON.stringify(metadata, null, 2)
      const encryptedData = this.persistenceConfig.encryptionKey ? this.encryption.encrypt(data) : data

      const metadataPath = getMetadataPath(this.persistenceConfig.dataPath, this.sessionId)
      fs.writeFileSync(metadataPath, encryptedData, "utf8")
      console.log(`[WhatsApp Engine] Session metadata saved for ${this.sessionId}`)
    } catch (error) {
      console.error(`[WhatsApp Engine] Error saving session metadata:`, error)
    }
  }

  /**
   * Loads session metadata for recovery
   */
  loadSessionMetadata(): { phoneNumber?: string; lastConnected?: string } | null {
    return loadMetadataFromFile(this.persistenceConfig.dataPath, this.sessionId, this.persistenceConfig.encryptionKey)
  }

  /**
   * Checks if a valid session exists for restoration
   */
  hasExistingSession(): boolean {
    return checkSessionExists(this.persistenceConfig.dataPath, this.sessionId)
  }

  /**
   * Starts heartbeat monitoring for session health
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(() => {
      this.lastHeartbeat = new Date()
      if (this.status === "connected") {
        this.saveSessionMetadata()
      }
    }, 30000) // Every 30 seconds
  }

  /**
   * Stops heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Schedules a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.persistenceConfig.autoReconnect) return
    if (this.reconnectAttempts >= this.persistenceConfig.maxReconnectAttempts) {
      console.log(`[WhatsApp Engine] Max reconnection attempts reached for ${this.sessionId}`)
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const delay = this.persistenceConfig.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    console.log(
      `[WhatsApp Engine] Scheduling reconnect for ${this.sessionId} in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    )

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++
      try {
        await this.initialize()
        this.reconnectAttempts = 0 // Reset on successful connection
      } catch (error) {
        console.error(`[WhatsApp Engine] Reconnection failed for ${this.sessionId}:`, error)
        this.scheduleReconnect()
      }
    }, delay)
  }

  /**
   * Cancels any pending reconnection
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
  }

  /**
   * Inicializa a sessão WhatsApp
   */
  async initialize(): Promise<void> {
    console.log(`[WhatsApp Engine] Initializing session: ${this.sessionId}`)
    this.status = "connecting"

    // Use sessionId as clientId for proper per-tenant session isolation
    // This ensures each tenant has their own auth directory and prevents lock conflicts
    const dataPath = this.persistenceConfig.dataPath
    const clientId = this.sessionId

    console.log(`[WhatsApp Engine] Using LocalAuth dataPath: ${dataPath}, clientId: ${clientId}`)
    console.log(`[WhatsApp Engine] Existing session: ${this.hasExistingSession()}`)

    // Remove stale Chromium lock files that may have been left by a crashed process
    // This prevents the "profile appears to be in use by another Chromium process" error
    const authDir = getAuthDir(dataPath, clientId)
    removeChromiumLockFiles(authDir)

    // 🔥 Remove locks do navegador (onde o Chromium trava)
    const sessionDir = getSessionDir(dataPath, clientId);

    // limpeza agressiva
    deepCleanChromiumLocks(sessionDir);


    // Load previous session metadata if available
    const metadata = this.loadSessionMetadata()
    if (metadata?.phoneNumber) {
      console.log(`[WhatsApp Engine] Previous session found for phone: ${metadata.phoneNumber}`)
    }

    // Mark initializing to prevent concurrent sends while client starts
    this.isInitializing = true

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId,
        dataPath,
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          // Additional flags to prevent profile lock issues
          "--disable-background-networking",
          "--disable-default-apps",
          "--disable-extensions",
          "--disable-sync",
          "--disable-translate",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-default-browser-check",
          "--safebrowsing-disable-auto-update",
        ],
      },
    })

    // Handle QR code event
    this.client.on("qr", (qr: string) => {
      this.qrCode = qr
      this.status = "qr_ready"
      console.log(`[WhatsApp ${this.sessionId}] QR Code received (length=${qr?.length})`)
      // Log a short prefix of the QR payload for debugging (avoid logging full potentially large string)
      try {
        console.log(`[WhatsApp ${this.sessionId}] QR preview: ${qr?.substring(0, 120)}`)
      } catch (e) {
        // ignore
      }
      // Print QR code to terminal for debugging
      qrcode.generate(qr, { small: true })
      this.handlers.onQRCode?.(qr)
    })

    // Handle ready event
    this.client.on("ready", async () => {
      this.status = "connected"

      // Try multiple approaches to get the phone number
      let phoneNumber: string | null = null

      // Approach 1: Get from client.info.wid.user
      const info = this.client?.info
      if (info?.wid?.user) {
        phoneNumber = info.wid.user
      }
      // Approach 2: Try wid._serialized and extract number
      else if (info?.wid?._serialized) {
        const serialized = info.wid._serialized
        const extracted = serialized.split("@")[0]
        phoneNumber = extracted || null
      }
      // Approach 3: Try me property
      else if (info?.me?.user) {
        phoneNumber = info.me.user
      }

      this.phoneNumber = phoneNumber
      console.log(`[WhatsApp ${this.sessionId}] Ready - Phone: ${this.phoneNumber}`)

      // Save session metadata for future recovery
      this.saveSessionMetadata()
      this.startHeartbeat()

      // Call onReady handler with phone number or empty string fallback
      this.handlers.onReady?.(this.phoneNumber || "")
    })

    // Handle authenticated event (session restored from storage)
    this.client.on("authenticated", () => {
      console.log(`[WhatsApp ${this.sessionId}] Authenticated (session restored or new login)`)
      this.reconnectAttempts = 0 // Reset reconnect attempts on successful auth
    })

    // Handle auth failure event
    this.client.on("auth_failure", (msg: string) => {
      console.error(`[WhatsApp ${this.sessionId}] Auth failure:`, msg)
      this.status = "error"
      this.stopHeartbeat()
      // On auth failure, the session data might be corrupted - don't auto-reconnect
    })

    // Handle disconnected event
    this.client.on("disconnected", (reason: string) => {
      this.status = "disconnected"
      console.log(`[WhatsApp ${this.sessionId}] Disconnected:`, reason)
      this.stopHeartbeat()
      this.handlers.onDisconnected?.(reason)

      // Schedule reconnection if enabled and not a logout
      if (reason !== "LOGOUT") {
        this.scheduleReconnect()
      }
    })

    // Handle incoming messages
    this.client.on("message", (message: any) => {
      // Guard against null/undefined message properties
      if (!message?.from || !message?.body) {
        console.warn(`[WhatsApp ${this.sessionId}] Received message with missing properties`)
        return
      }
      // Cache last inbound digits from classic JID to help avoid LID-derived misrouting
      try {
        const fromStr: string = String(message.from)
        const isClassic = fromStr.endsWith("@c.us") || fromStr.endsWith("@s.whatsapp.net")
        if (isClassic) {
          this.lastInboundDigits = fromStr.replace(/\D/g, "") || null
        }
      } catch {
        // ignore cache errors
      }
      this.handlers.onMessage?.({
        from: message.from,
        body: message.body,
        timestamp: new Date(message.timestamp * 1000),
        isGroup: message.from.includes("@g.us"),
      })
    })

    try {
      // Initialize the client
      await this.client.initialize()
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Resolves the correct chat ID format (LID or c.us) for a phone number
   * WhatsApp now requires @lid format for some phone numbers
   *
   * Note: This method should only be called when the client is connected,
   * as it relies on the WhatsApp Web API to retrieve LID information.
   */
  private async resolveChatId(phoneNumber: string): Promise<string> {
    // If already formatted with suffix, return as-is
    if (phoneNumber.includes("@")) {
      return phoneNumber
    }

    // Guard: Ensure client is available
    if (!this.client) {
      console.warn(`[WhatsApp Engine] Client not available for LID lookup, using fallback format`)
      return `${phoneNumber}@c.us`
    }

    // Prefer classic @c.us addressing to avoid LID misrouting unless explicitly disabled
    try {
      const preferCUS = process.env.WHATSAPP_PREFER_CUS !== "false"
      if (preferCUS) {
        let digits = String(phoneNumber).replace(/\D/g, "")

        // Heuristic fix: if the target looks like an LID-derived number (commonly starting with 84...)
        // and we have a recent inbound classic JID cached, prefer that instead to avoid misrouting.
        // Example: inbound remoteJid was 5511942774485@s.whatsapp.net but remoteJidAlt (LID) was 84027394506995@lid.
        // If the caller passed 84027394506995, we swap to the last inbound digits 5511942774485.
        const looksLikeLidDerived = /^84\d{10,13}$/.test(digits)
        if (looksLikeLidDerived && this.lastInboundDigits) {
          console.log(
            `[WhatsApp Engine] Correcting LID-derived target ${digits} -> ${this.lastInboundDigits} based on last inbound`
          )
          digits = this.lastInboundDigits
        }

        const chatId = `${digits}@c.us`
        // For new numbers (no prior chat), WhatsApp will still accept direct send to c.us
        // Return immediately to avoid any LID discovery/misrouting.
        return chatId
      }
    } catch (e) {
      console.warn(`[WhatsApp Engine] preferCUS check failed for ${phoneNumber}:`, e)
    }

    try {
      const clientAny = this.client as any

      // 1) Preferred: getContactLidAndPhone (returns lid when available)
      try {
        if (clientAny && typeof clientAny.getContactLidAndPhone === "function") {
          const lidInfo = await clientAny.getContactLidAndPhone([phoneNumber])
          if (lidInfo && lidInfo.length > 0 && lidInfo[0]?.lid) {
            const lid = lidInfo[0].lid
            if (typeof lid === "string" && lid.includes("@")) {
              console.log(`[WhatsApp Engine] Using LID format for ${phoneNumber}: ${lid}`)
              return lid
            }
          }
        }
      } catch (e) {
        console.warn(`[WhatsApp Engine] getContactLidAndPhone failed for ${phoneNumber}:`, e)
      }

      // 2) Try getNumberId which may return an id object or null
      try {
        if (clientAny && typeof clientAny.getNumberId === "function") {
          const numId = await clientAny.getNumberId(phoneNumber)
          if (numId && (numId._serialized || numId.id)) {
            const idVal = numId._serialized || numId.id || String(numId)
            console.log(`[WhatsApp Engine] getNumberId resolved for ${phoneNumber}: ${idVal}`)
            return idVal.includes("@") ? idVal : `${idVal}@c.us`
          }
        }
      } catch (e) {
        console.warn(`[WhatsApp Engine] getNumberId failed for ${phoneNumber}:`, e)
      }

      // 3) Try to find contact via getContacts() and use its id
      try {
        if (clientAny && typeof clientAny.getContacts === "function") {
          const contacts = await clientAny.getContacts()
          if (Array.isArray(contacts)) {
            const found = contacts.find((c: any) => {
              const pn = c?.phoneNumber || c?.number || c?.pn || ""
              // compare last digits to be more tolerant
              return pn && pn.replace(/\D/g, "").endsWith(phoneNumber.replace(/\D/g, ""))
            })
            if (found && found.id) {
              const idVal = found.id._serialized || found.id
              console.log(`[WhatsApp Engine] Found contact via getContacts for ${phoneNumber}: ${idVal}`)
              return idVal.includes("@") ? idVal : `${idVal}@c.us`
            }
          }
        }
      } catch (e) {
        console.warn(`[WhatsApp Engine] getContacts search failed for ${phoneNumber}:`, e)
      }

      // 4) Try to find chat via getChats() and use its id
      try {
        if (clientAny && typeof clientAny.getChats === "function") {
          const chats = await clientAny.getChats()
          if (Array.isArray(chats)) {
            const digits = phoneNumber.replace(/\D/g, "")
            // Only accept classic JIDs; ignore LID matches to avoid misrouting
            const foundChat = chats.find((ch: any) => {
              try {
                const idStr = ch?.id?._serialized || ch?.id || ""
                // must be c.us or s.whatsapp.net
                const isClassic = idStr.endsWith("@c.us") || idStr.endsWith("@s.whatsapp.net")
                const idDigits = idStr.replace(/\D/g, "")
                return isClassic && idDigits.endsWith(digits)
              } catch {
                return false
              }
            })
            if (foundChat && foundChat.id) {
              const idVal = foundChat.id._serialized || foundChat.id
              console.log(`[WhatsApp Engine] Found classic chat via getChats for ${phoneNumber}: ${idVal}`)
              return idVal.includes("@") ? idVal : `${idVal}@c.us`
            }
          }
        }
      } catch (e) {
        console.warn(`[WhatsApp Engine] getChats search failed for ${phoneNumber}:`, e)
      }
    } catch (outer) {
      console.warn(`[WhatsApp Engine] Unexpected error during resolveChatId for ${phoneNumber}:`, outer)
    }

    // Final fallback
    console.warn(`[WhatsApp Engine] Falling back to ${phoneNumber}@c.us for ${phoneNumber}`)
    return `${phoneNumber}@c.us`
  }

  /**
 * Simula o "digitando..." no WhatsApp
 */
async simulateTyping(to: string, text: string): Promise<void> {
  if (!this.client) return;

  try {
    // If target is LID, skip typing simulation to avoid failures on new users
    const resolved = await this.resolveChatId(to);
    if (resolved.endsWith("@lid")) {
      return;
    }

    const chat = await this.client.getChatById(resolved);

    if (!chat?.sendStateTyping || !chat?.clearState) {
      console.warn("[Typing] Método de estado de digitação não disponível nesta versão.");
      return;
    }

    // tempo proporcional ao tamanho da mensagem
    const typingTime = Math.min(5000, 800 + text.length * 30);

    await chat.sendStateTyping();
    await new Promise((resolve) => setTimeout(resolve, typingTime));
    await chat.clearState();
  } catch (err) {
    console.error("[Typing] Erro ao simular digitando:", err);
  }
}


  /**
   * Envia uma mensagem de texto
   */
  async sendMessage(message: WhatsAppMessage): Promise<SendMessageResult> {
    if (this.isInitializing) {
      return { success: false, error: "WhatsApp engine initializing, tente novamente em alguns segundos." }
    }

    if (this.status !== "connected" || !this.client) {
      return {
        success: false,
        error: "WhatsApp not connected",
      }
    }

    try {
      // Guard: check internal puppeteer page presence used by whatsapp-web.js
      const internalClient = this.client as any
      const hasPage = internalClient && (internalClient.page || internalClient.pupPage || internalClient.puppeteerPage)
      if (!hasPage) {
        // schedule reconnect and return friendly error
        console.warn(`[WhatsApp Engine] sendMessage called but puppeteer page missing for ${this.sessionId}`)
        this.status = "disconnected"
        this.stopHeartbeat()
        try {
          if (this.client) {
            await this.client.destroy()
          }
        } catch (e) {
          console.warn(e)
        }
        this.client = null
        this.scheduleReconnect()
        return {
          success: false,
          error: "Puppeteer page indisponível. Reconectando, tente novamente em alguns segundos.",
        }
      }
      await this.simulateTyping(message.to, message.content);

      // Resolve the correct chat ID format (LID or c.us)
      const chatId = await this.resolveChatId(message.to)
      const result = await this.client.sendMessage(chatId, message.content)

      console.log(`[WhatsApp Engine] Message sent to ${message.to}: ${message.content.substring(0, 50)}...`)

      return {
        success: true,
        messageId: result.id._serialized,
      }
    } catch (error) {
      console.error(`[WhatsApp Engine] Send message error:`, error)

      // Detect common puppeteer/page null errors coming from whatsapp-web.js
      const msg = error instanceof Error ? error.message : String(error)
      if (
        msg.includes("reading 'evaluate'") ||
        msg.includes("Cannot read properties of null") ||
        msg.includes("evaluate")
      ) {
        // Mark session as disconnected and schedule a reconnect
        try {
          this.status = "disconnected"
          this.stopHeartbeat()
          if (this.client) {
            try {
              await this.client.destroy()
            } catch (e) {
              console.warn(`[WhatsApp Engine] Error destroying client after page error:`, e)
            }
            this.client = null
          }
        } catch (e) {
          console.warn(`[WhatsApp Engine] Error while handling broken client:`, e)
        }

        // Schedule reconnect so engine tries to restore session
        this.scheduleReconnect()

        return {
          success: false,
          error: "Session error (puppeteer page missing). Reconnecting, tente novamente em alguns segundos.",
        }
      }

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

    if (this.status !== "connected" || !this.client) {
      return {
        success: false,
        error: "WhatsApp not connected",
      }
    }

    try {
      const media = await MessageMedia.fromUrl(message.mediaUrl, { unsafeMime: true })
      // Resolve the correct chat ID format (LID or c.us)
      const chatId = await this.resolveChatId(message.to)
      const result = await this.client.sendMessage(chatId, media, { caption: message.content })

      console.log(`[WhatsApp Engine] Media sent to ${message.to}`)

      return {
        success: true,
        messageId: result.id._serialized,
      }
    } catch (error) {
      console.error(`[WhatsApp Engine] Send media error:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      if (
        msg.includes("reading 'evaluate'") ||
        msg.includes("Cannot read properties of null") ||
        msg.includes("evaluate")
      ) {
        try {
          this.status = "disconnected"
          this.stopHeartbeat()
          if (this.client) {
            try {
              await this.client.destroy()
            } catch (e) {
              console.warn(`[WhatsApp Engine] Error destroying client after page error:`, e)
            }
            this.client = null
          }
        } catch (e) {
          console.warn(`[WhatsApp Engine] Error while handling broken client:`, e)
        }
        this.scheduleReconnect()
        return {
          success: false,
          error: "Session error (puppeteer page missing). Reconnecting, tente novamente em alguns segundos.",
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Envia botões nativos do WhatsApp
   */
  async sendButtonsMessage(opts: { to: string; message: any }): Promise<SendMessageResult> {
    try {
      if (!this.client) {
        return { success: false, error: "WhatsApp client não inicializado" }
      }

      const chatId = await this.resolveChatId(opts.to)

      const result = await this.client.sendMessage(chatId, opts.message)

      return {
        success: true,
        messageId: result?.id?._serialized ?? undefined,
      }
    } catch (error) {
      console.error("[WhatsAppEngine] Erro ao enviar botões:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
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
    try {
      // Reinitialize to get new QR code
      if (this.client) {
        await this.disconnect()
      }
      await this.initialize()
      return this.qrCode
    } catch (error) {
      console.error(`[WhatsApp Engine] Error refreshing QR code:`, error)
      this.status = "error"
      return null
    }
  }

  /**
   * Desconecta a sessão
   * @param preserveSession - If true, keeps session data for future restoration
   */
  async disconnect(preserveSession = false): Promise<void> {
    const client = this.client
    this.client = null

    // Cancel any pending reconnection
    this.cancelReconnect()
    this.stopHeartbeat()

    if (client) {
      try {
        if (!preserveSession) {
          await client.logout()
        }
      } catch (error) {
        // Log but don't throw - logout may fail if already disconnected
        console.warn(`[WhatsApp Engine] Logout warning:`, error)
      }
      try {
        await client.destroy()
      } catch (error) {
        // Log but don't throw - destroy may fail if already destroyed
        console.warn(`[WhatsApp Engine] Destroy warning:`, error)
      }
    }

    this.status = "disconnected"
    this.qrCode = null
    this.phoneNumber = null
    console.log(`[WhatsApp Engine] Session ${this.sessionId} disconnected (preserveSession=${preserveSession})`)
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

/**
 * Session persistence configuration for the manager
 */
interface ManagerConfig {
  /** Base path for storing session data */
  dataPath: string
  /** Whether to backup session data for recovery */
  enableBackup: boolean
  /** Encryption key for sensitive session data (optional) */
  encryptionKey?: string
  /** Auto-reconnect on disconnect */
  autoReconnect: boolean
  /** Max reconnection attempts */
  maxReconnectAttempts: number
  /** Delay between reconnection attempts (ms) */
  reconnectDelay: number
}

const DEFAULT_MANAGER_CONFIG: ManagerConfig = {
  dataPath: process.env.WHATSAPP_SESSION_PATH || "./sessions",
  enableBackup: true,
  encryptionKey: process.env.WHATSAPP_SESSION_ENCRYPTION_KEY,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 5000,
}

class WhatsAppManager {
  private engines: Map<string, WhatsAppEngine> = new Map()
  private config: ManagerConfig

  constructor(config?: Partial<ManagerConfig>) {
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config }
  }

  getEngine(sessionId: string): WhatsAppEngine | undefined {
    return this.engines.get(sessionId)
  }

  /**
   * Gets all active engines as [sessionId, engine] pairs
   * Used by webhook handlers to find the appropriate engine for a phone number
   */
  getAllEngines(): Array<[string, WhatsAppEngine]> {
    return Array.from(this.engines.entries())
  }

  /**
   * Creates a new WhatsApp engine with session persistence
   */
  async createEngine(sessionId: string, handlers: WhatsAppEventHandlers = {}): Promise<WhatsAppEngine> {
    if (this.engines.has(sessionId)) {
      return this.engines.get(sessionId)!
    }

    const engine = new WhatsAppEngine(sessionId, handlers, this.config)
    this.engines.set(sessionId, engine)
    return engine
  }

  /**
   * Removes an engine and disconnects it
   * @param sessionId - The session ID
   * @param preserveSession - If true, keeps session data for future restoration
   */
  async removeEngine(sessionId: string, preserveSession = false): Promise<void> {
    const engine = this.engines.get(sessionId)
    if (engine) {
      await engine.disconnect(preserveSession)
      this.engines.delete(sessionId)
    }
  }

  /**
   * Gets all active session statuses
   */
  getAllSessions(): WhatsAppSessionInfo[] {
    return Array.from(this.engines.values()).map((e) => e.getStatus())
  }

  /**
   * Checks if a session has existing data that can be restored
   * Uses static utility function for efficiency (no engine instantiation needed)
   */
  hasExistingSession(sessionId: string): boolean {
    return checkSessionExists(this.config.dataPath, sessionId)
  }

  /**
   * Gets metadata for an existing session without initializing it
   * Uses static utility function for efficiency (no engine instantiation needed)
   */
  getSessionMetadata(sessionId: string): { phoneNumber?: string; lastConnected?: string } | null {
    return loadMetadataFromFile(this.config.dataPath, sessionId, this.config.encryptionKey)
  }

  /**
   * Lists all sessions that have persisted data
   */
  listPersistedSessions(): string[] {
    try {
      const sessionsPath = this.config.dataPath
      if (!fs.existsSync(sessionsPath)) return []

      const dirs = fs
        .readdirSync(sessionsPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith("session-"))
        .map((dirent) => dirent.name.replace("session-", ""))

      return dirs
    } catch (error) {
      console.error("[WhatsApp Manager] Error listing persisted sessions:", error)
      return []
    }
  }

  /**
   * Deletes all session data for a given session ID
   */
  async deleteSessionData(sessionId: string): Promise<boolean> {
    try {
      const sessionDir = getSessionDir(this.config.dataPath, sessionId)
      const authDir = getAuthDir(this.config.dataPath, sessionId)

      // Remove session directory
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true })
      }

      // Remove LocalAuth directory
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true })
      }

      console.log(`[WhatsApp Manager] Deleted session data for ${sessionId}`)
      return true
    } catch (error) {
      console.error(`[WhatsApp Manager] Error deleting session data for ${sessionId}:`, error)
      return false
    }
  }

  /**
   * Cleans up legacy session data from the old shared clientId naming.
   * Previously, all tenants shared a single "bot-session" clientId which caused
   * Chromium profile lock conflicts. This method removes that legacy data.
   *
   * This operation is safe to call multiple times and is idempotent.
   *
   * @returns true if cleanup was performed, false if no legacy data found or on error
   * @throws Never throws - errors are logged and return false
   *
   * @example
   * const cleaned = await manager.cleanupLegacySessionData()
   * if (cleaned) {
   *   console.log("Legacy data was removed")
   * }
   */
  async cleanupLegacySessionData(): Promise<boolean> {
    const legacyClientId = "bot-session"
    try {
      const legacyAuthDir = getAuthDir(this.config.dataPath, legacyClientId)
      const legacySessionDir = getSessionDir(this.config.dataPath, legacyClientId)

      let cleaned = false

      // Remove legacy auth directory if it exists
      if (fs.existsSync(legacyAuthDir)) {
        console.log(`[WhatsApp Manager] Cleaning up legacy auth directory: ${legacyAuthDir}`)
        // First remove any lock files
        removeChromiumLockFiles(legacyAuthDir)
        // Then remove the entire directory
        try {
          fs.rmSync(legacyAuthDir, { recursive: true, force: true })
          cleaned = true
        } catch (rmError) {
          console.error(`[WhatsApp Manager] Error removing legacy auth directory:`, rmError)
        }
      }

      // Remove legacy session directory if it exists
      if (fs.existsSync(legacySessionDir)) {
        console.log(`[WhatsApp Manager] Cleaning up legacy session directory: ${legacySessionDir}`)
        try {
          fs.rmSync(legacySessionDir, { recursive: true, force: true })
          cleaned = true
        } catch (rmError) {
          console.error(`[WhatsApp Manager] Error removing legacy session directory:`, rmError)
        }
      }

      // Also clean up any orphaned lock files in the entire .wwebjs_auth directory
      const authBaseDir = path.join(this.config.dataPath, WWEBJS_AUTH_DIR)
      if (fs.existsSync(authBaseDir)) {
        console.log(`[WhatsApp Manager] Scanning for orphaned lock files in: ${authBaseDir}`)
        removeChromiumLockFiles(authBaseDir)
      }

      if (cleaned) {
        console.log(`[WhatsApp Manager] Legacy session data cleanup completed`)
      }

      return cleaned
    } catch (error) {
      // Log the error but return false to indicate cleanup was not completed
      // This prevents server startup from failing due to cleanup issues
      console.error(`[WhatsApp Manager] Error cleaning up legacy session data:`, error)
      return false
    }
  }
}

export const whatsappManager = new WhatsAppManager()
