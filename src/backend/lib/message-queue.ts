// =====================================================
// MESSAGE QUEUE - Fila de processamento de mensagens
// =====================================================

import { query, update } from "./db"
import type { ScheduledMessage } from "./types"
import type { WhatsAppEngine } from "./whatsapp-engine"

interface QueueConfig {
  batchSize: number
  intervalMs: number
  maxRetries: number
}

const DEFAULT_CONFIG: QueueConfig = {
  batchSize: 10,
  intervalMs: 5000, // 5 segundos entre batches
  maxRetries: 3,
}

export class MessageQueue {
  private tenantId: string
  private engine: WhatsAppEngine
  private config: QueueConfig
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  constructor(tenantId: string, engine: WhatsAppEngine, config: Partial<QueueConfig> = {}) {
    this.tenantId = tenantId
    this.engine = engine
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Inicia o processamento da fila
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    console.log(`[Message Queue] Started for tenant ${this.tenantId}`)

    this.intervalId = setInterval(() => {
      this.processNextBatch()
    }, this.config.intervalMs)

    // Processa imediatamente
    this.processNextBatch()
  }

  /**
   * Para o processamento da fila
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log(`[Message Queue] Stopped for tenant ${this.tenantId}`)
  }

  /**
   * Processa o próximo batch de mensagens
   */
  private async processNextBatch(): Promise<void> {
    if (!this.engine.isConnected()) {
      console.log("[Message Queue] WhatsApp not connected, skipping batch")
      return
    }

    try {
      // Atomically claim a batch of pending messages to avoid duplicate processing
      const messages = await query<ScheduledMessage>(
        `WITH cte AS (
           SELECT id FROM scheduled_messages
           WHERE tenant_id = $1
             AND status = 'pending'
             AND scheduled_for <= NOW()
             AND attempts < $2
           ORDER BY scheduled_for
           FOR UPDATE SKIP LOCKED
           LIMIT $3
         )
         UPDATE scheduled_messages
         SET status = 'processing', last_attempt = NOW()
         FROM cte
         WHERE scheduled_messages.id = cte.id
         RETURNING scheduled_messages.*;`,
        [this.tenantId, this.config.maxRetries, this.config.batchSize]
      )

      if (messages.length === 0) return

      console.log(`[Message Queue] Processing ${messages.length} messages`)

      for (const message of messages) {
        await this.processMessage(message)
        // Delay entre mensagens para evitar bloqueio
        await this.delay(1000 + Math.random() * 2000)
      }
    } catch (error) {
      console.error("[Message Queue] Error processing batch:", error)
    }
  }

  /**
   * Processa uma mensagem individual
   */
  private async processMessage(message: ScheduledMessage): Promise<void> {
    try {
      // Marca como processando
      await update("scheduled_messages", message.id, {
        status: "processing",
        last_attempt: new Date().toISOString(),
      })

      // Dedupe: evita reenvio se já houve mensagem idêntica recentemente
      try {
        const dup = await query<{ one: number }>(
          `SELECT 1 FROM message_logs WHERE tenant_id = $1 AND phone = $2 AND message_content = $3 AND status = 'sent' AND sent_at >= NOW() - INTERVAL '2 minutes' LIMIT 1`,
          [this.tenantId, message.phone, message.message_content]
        )
        if (dup && dup.length > 0) {
          // Marca como enviado para não reprocessar
          await update("scheduled_messages", message.id, {
            status: "sent",
            attempts: message.attempts + 1,
          })
          await this.logMessage(message, "sent")
          console.log(`[Message Queue] Message ${message.id} skipped (duplicate detected)`)
          return
        }
      } catch (e) {
        console.warn(`[Message Queue] Dedupe check failed for ${message.id}:`, e)
      }

      // Envia a mensagem
      const result = await this.engine.sendMessage({
        to: message.phone,
        content: message.message_content,
      })

      if (result.success) {
        // Sucesso - atualiza status
        await update("scheduled_messages", message.id, {
          status: "sent",
          attempts: message.attempts + 1,
        })

        // Registra no log
        await this.logMessage(message, "sent")

        console.log(`[Message Queue] Message ${message.id} sent successfully`)
      } else {
        // Falha - incrementa tentativas
        const newAttempts = message.attempts + 1
        await update("scheduled_messages", message.id, {
          status: newAttempts >= this.config.maxRetries ? "failed" : "pending",
          attempts: newAttempts,
          error_message: result.error,
        })

        if (newAttempts >= this.config.maxRetries) {
          await this.logMessage(message, "failed", result.error)
        }

        console.log(`[Message Queue] Message ${message.id} failed: ${result.error}`)
      }
    } catch (error) {
      console.error(`[Message Queue] Error processing message ${message.id}:`, error)

      await update("scheduled_messages", message.id, {
        status: "pending",
        attempts: message.attempts + 1,
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Registra mensagem no log
   */
  private async logMessage(
    message: ScheduledMessage,
    status: "sent" | "failed",
    errorMessage?: string
  ): Promise<void> {
      await query(
      `INSERT INTO message_logs (tenant_id, customer_id, order_id, flow_id, phone, message_content, status, sent_at, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        this.tenantId,
        message.customer_id,
        message.order_id,
        message.flow_id,
        message.phone,
        message.message_content,
        status,
        status === "sent" ? new Date().toISOString() : null,
        errorMessage,
        JSON.stringify({ processor: "inproc", scheduled_message_id: message.id }),
      ]
    )
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
