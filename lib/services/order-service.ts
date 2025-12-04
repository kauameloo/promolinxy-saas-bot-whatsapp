// =====================================================
// ORDER SERVICE - Gerenciamento de pedidos
// =====================================================

import { query, queryOne, insert, update } from "@/lib/db"
import type { Order, CaktoWebhookPayload, OrderStatus } from "@/lib/types"
import { getPixCode } from "@/lib/utils/message-parser"

export class OrderService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Cria ou atualiza pedido baseado no webhook
   */
  async createFromWebhook(payload: CaktoWebhookPayload, customerId: string | null): Promise<Order> {
    const externalId = payload.transaction_id

    // Se já existe, atualiza
    if (externalId) {
      const existing = await this.findByExternalId(externalId)
      if (existing) {
        console.log(`Order found by transaction_id ${externalId}, updating...`)
        return this.updateFromWebhook(existing.id, payload)
      }
    }

    // Determina o status baseado no evento
    const status = this.getStatusFromEvent(payload.event)

    // Cria novo pedido com todos os dados disponíveis
    const orderData = {
      tenant_id: this.tenantId,
      customer_id: customerId,
      external_id: externalId,
      product_name: payload.product?.name,
      product_id: payload.product?.id,
      amount: payload.payment?.amount || payload.product?.price,
      status,
      payment_method: payload.payment?.method,
      payment_url: payload.payment?.checkout_url,
      pix_code: getPixCode(payload.payment),
      boleto_url: payload.payment?.boleto_url,
      checkout_url: payload.payment?.checkout_url,
      metadata: JSON.stringify({
        ...(payload.metadata || {}),
        payment_status: payload.payment?.status,
        event_type: payload.event,
        timestamp: payload.timestamp,
      }),
    }

    const { metadata, ...logData } = orderData
    console.log("Creating new order:", logData)
    
    const order = await insert<Order>("orders", orderData)
    console.log(`✓ New order created: ${order.id}`)

    return order
  }

  /**
   * Atualiza pedido existente
   */
  async updateFromWebhook(id: string, payload: CaktoWebhookPayload): Promise<Order> {
    const status = this.getStatusFromEvent(payload.event)

    const updateData = {
      status,
      payment_method: payload.payment?.method,
      pix_code: getPixCode(payload.payment),
      boleto_url: payload.payment?.boleto_url,
      payment_url: payload.payment?.checkout_url,
      checkout_url: payload.payment?.checkout_url,
      metadata: JSON.stringify({
        ...(payload.metadata || {}),
        payment_status: payload.payment?.status,
        event_type: payload.event,
        timestamp: payload.timestamp,
      }),
    }

    const { metadata, ...logData } = updateData
    console.log(`Updating order ${id} with:`, logData)

    const updated = await update<Order>("orders", id, updateData)
    console.log("✓ Order updated successfully")

    return updated!
  }

  /**
   * Determina status baseado no evento
   */
  private getStatusFromEvent(event: string): OrderStatus {
    switch (event) {
      case "purchase_approved":
        return "paid"
      case "purchase_refused":
        return "refused"
      case "checkout_abandonment":
        return "cancelled"
      default:
        return "pending"
    }
  }

  /**
   * Busca pedido por ID externo
   */
  async findByExternalId(externalId: string): Promise<Order | null> {
    return queryOne<Order>(`SELECT * FROM orders WHERE external_id = $1 AND tenant_id = $2`, [
      externalId,
      this.tenantId,
    ])
  }

  /**
   * Lista pedidos com paginação
   */
  async list(page = 1, limit = 20, status?: OrderStatus): Promise<{ orders: Order[]; total: number }> {
    const offset = (page - 1) * limit

    let queryText = `
      SELECT o.*, 
             json_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email) as customer
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.tenant_id = $1
    `
    const params: unknown[] = [this.tenantId]

    if (status) {
      queryText += ` AND o.status = $2`
      params.push(status)
    }

    queryText += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const orders = await query<Order>(queryText, params)

    let countQuery = `SELECT COUNT(*) as count FROM orders WHERE tenant_id = $1`
    const countParams: unknown[] = [this.tenantId]

    if (status) {
      countQuery += ` AND status = $2`
      countParams.push(status)
    }

    const countResult = await queryOne<{ count: string }>(countQuery, countParams)

    return {
      orders,
      total: Number.parseInt(countResult?.count || "0"),
    }
  }

  /**
   * Busca pedido por ID
   */
  async findById(id: string): Promise<Order | null> {
    return queryOne<Order>(
      `SELECT o.*, 
              json_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email) as customer
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [id, this.tenantId],
    )
  }

  /**
   * Conta pedidos por status
   */
  async countByStatus(): Promise<Record<OrderStatus, number>> {
    const results = await query<{ status: OrderStatus; count: string }>(
      `SELECT status, COUNT(*) as count 
       FROM orders 
       WHERE tenant_id = $1 
       GROUP BY status`,
      [this.tenantId],
    )

    const counts: Record<OrderStatus, number> = {
      pending: 0,
      paid: 0,
      refused: 0,
      refunded: 0,
      cancelled: 0,
    }

    results.forEach((r) => {
      counts[r.status] = Number.parseInt(r.count)
    })

    return counts
  }
}
