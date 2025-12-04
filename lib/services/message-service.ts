// =====================================================
// MESSAGE SERVICE - Envio e agendamento de mensagens
// =====================================================

import { query, queryOne, insert, update } from "@/lib/db"
import type { MessageLog, ScheduledMessage, MessageVariables, MessageFlow, Customer, Order } from "@/lib/types"
import { parseMessage, formatCurrency } from "@/lib/utils/message-parser"

export class MessageService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Agenda mensagens de um fluxo para um cliente
   */
  async scheduleFlowMessages(flow: MessageFlow, customer: Customer, order: Order, isDebugMode = false): Promise<ScheduledMessage[]> {
    if (!flow.messages || flow.messages.length === 0) {
      return []
    }

    const scheduledMessages: ScheduledMessage[] = []
    let cumulativeDelay = 0

    // Prepara variáveis para substituição
    const variables: MessageVariables = {
      nome: customer.name,
      email: customer.email || "",
      telefone: customer.phone,
      produto: order.product_name || "",
      preco: order.amount ? formatCurrency(order.amount) : "",
      link_boleto: order.boleto_url || "",
      qr_code: order.pix_code || "",
      link_checkout: order.checkout_url || order.payment_url || "",
      link_pix: order.pix_code || "",
    }

    if (isDebugMode) {
      console.log("Message variables for flow:", {
        nome: variables.nome,
        email: variables.email || "(empty)",
        telefone: variables.telefone,
        produto: variables.produto || "(empty)",
        preco: variables.preco || "(empty)",
        hasLinkBoleto: !!variables.link_boleto,
        hasQrCode: !!variables.qr_code,
        hasLinkCheckout: !!variables.link_checkout,
      })
    }

    for (const message of flow.messages) {
      if (!message.is_active) continue

      cumulativeDelay += message.delay_minutes

      // Calcula horário de envio
      const scheduledFor = new Date()
      scheduledFor.setMinutes(scheduledFor.getMinutes() + cumulativeDelay)

      // Processa o template
      const processedContent = parseMessage(message.content, variables)

      // Cria mensagem agendada
      // Evita criar duplicatas: se já existe uma mensagem pendente para o
      // mesmo tenant + phone + order + flow_message_id, pulamos a inserção.
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM scheduled_messages
         WHERE tenant_id = $1
           AND phone = $2
           AND order_id = $3
           AND flow_message_id = $4
           AND status = 'pending'
         LIMIT 1`,
        [this.tenantId, customer.phone, order.id, message.id],
      )

      if (existing) {
        if (isDebugMode) {
          console.log(
            `Skipping duplicate scheduled message (flow_message_id=${message.id}) for phone=${customer.phone}`,
          )
        }
        // Mantemos a lista retornada consistente (não inserimos, mas não falhamos)
        continue
      }

      const scheduled = await insert<ScheduledMessage>("scheduled_messages", {
        tenant_id: this.tenantId,
        customer_id: customer.id,
        order_id: order.id,
        flow_id: flow.id,
        flow_message_id: message.id,
        phone: customer.phone,
        message_content: processedContent,
        scheduled_for: scheduledFor.toISOString(),
        status: "pending",
        attempts: 0,
      })

      if (isDebugMode) {
        console.log(`  → Message scheduled for ${scheduledFor.toISOString()} (delay: ${cumulativeDelay}min)`)
      }
      scheduledMessages.push(scheduled)
    }

    return scheduledMessages
  }

  /**
   * Busca mensagens prontas para envio
   */
  async getPendingMessages(limit = 50): Promise<ScheduledMessage[]> {
    return query<ScheduledMessage>(
      `SELECT * FROM scheduled_messages 
       WHERE tenant_id = $1 
       AND status = 'pending' 
       AND scheduled_for <= NOW()
       AND attempts < 3
       ORDER BY scheduled_for
       LIMIT $2`,
      [this.tenantId, limit],
    )
  }

  /**
   * Marca mensagem como enviada
   */
  async markAsSent(id: string): Promise<void> {
    await update("scheduled_messages", id, {
      status: "sent",
      attempts: 1,
      last_attempt: new Date().toISOString(),
    })
  }

  /**
   * Marca mensagem como falha
   */
  async markAsFailed(id: string, error: string): Promise<void> {
    const message = await queryOne<ScheduledMessage>(`SELECT attempts FROM scheduled_messages WHERE id = $1`, [id])

    await update("scheduled_messages", id, {
      status: (message?.attempts || 0) >= 2 ? "failed" : "pending",
      attempts: (message?.attempts || 0) + 1,
      last_attempt: new Date().toISOString(),
      error_message: error,
    })
  }

  /**
   * Cancela mensagens pendentes de um pedido
   */
  async cancelOrderMessages(orderId: string): Promise<void> {
    await query(
      `UPDATE scheduled_messages 
       SET status = 'cancelled' 
       WHERE order_id = $1 AND status = 'pending'`,
      [orderId],
    )
  }

  /**
   * Registra log de mensagem enviada
   */
  async logMessage(data: {
    customer_id?: string
    order_id?: string
    flow_id?: string
    phone: string
    message_content: string
    status: "sent" | "delivered" | "read" | "failed"
    error_message?: string
  }): Promise<MessageLog> {
    return insert<MessageLog>("message_logs", {
      tenant_id: this.tenantId,
      customer_id: data.customer_id,
      order_id: data.order_id,
      flow_id: data.flow_id,
      phone: data.phone,
      message_content: data.message_content,
      status: data.status,
      sent_at: data.status === "sent" ? new Date().toISOString() : null,
      error_message: data.error_message,
      metadata: JSON.stringify({}),
    })
  }

  /**
   * Lista logs de mensagens
   */
  async getLogs(
    page = 1,
    limit = 50,
    filters?: { status?: string; customerId?: string },
  ): Promise<{ logs: MessageLog[]; total: number }> {
    const offset = (page - 1) * limit
    let queryText = `
      SELECT ml.*, c.name as customer_name
      FROM message_logs ml
      LEFT JOIN customers c ON ml.customer_id = c.id
      WHERE ml.tenant_id = $1
    `
    const params: unknown[] = [this.tenantId]

    if (filters?.status) {
      queryText += ` AND ml.status = $${params.length + 1}`
      params.push(filters.status)
    }

    if (filters?.customerId) {
      queryText += ` AND ml.customer_id = $${params.length + 1}`
      params.push(filters.customerId)
    }

    queryText += ` ORDER BY ml.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const logs = await query<MessageLog>(queryText, params)

    let countQuery = `SELECT COUNT(*) as count FROM message_logs WHERE tenant_id = $1`
    const countParams: unknown[] = [this.tenantId]

    if (filters?.status) {
      countQuery += ` AND status = $2`
      countParams.push(filters.status)
    }

    const countResult = await queryOne<{ count: string }>(countQuery, countParams)

    return {
      logs,
      total: Number.parseInt(countResult?.count || "0"),
    }
  }
}
