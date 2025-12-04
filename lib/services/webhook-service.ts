// =====================================================
// WEBHOOK SERVICE - Processamento de webhooks Cakto
// =====================================================

import { insert, query, update } from "@/lib/db"
import type { WebhookEvent, CaktoWebhookPayload } from "@/lib/types"
import { CustomerService } from "./customer-service"
import { OrderService } from "./order-service"
import { FlowService } from "./flow-service"
import { MessageService } from "./message-service"

export class WebhookService {
  private tenantId: string
  private customerService: CustomerService
  private orderService: OrderService
  private flowService: FlowService
  private messageService: MessageService

  constructor(tenantId: string) {
    this.tenantId = tenantId
    this.customerService = new CustomerService(tenantId)
    this.orderService = new OrderService(tenantId)
    this.flowService = new FlowService(tenantId)
    this.messageService = new MessageService(tenantId)
  }

  /**
   * Processa webhook da Cakto
   */
  async processWebhook(payload: CaktoWebhookPayload): Promise<WebhookEvent> {
    // Registra o evento
    const event = await insert<WebhookEvent>("webhook_events", {
      tenant_id: this.tenantId,
      event_type: payload.event,
      source: "cakto",
      payload: JSON.stringify(payload),
      processed: false,
      retry_count: 0,
    })

    try {
      // Processa baseado no tipo de evento
      await this.handleEvent(payload)

      // Marca como processado
      await update("webhook_events", event.id, {
        processed: true,
        processed_at: new Date().toISOString(),
      })

      return { ...event, processed: true }
    } catch (error) {
      // Registra erro
      await update("webhook_events", event.id, {
        error_message: error instanceof Error ? error.message : "Unknown error",
        retry_count: event.retry_count + 1,
      })

      throw error
    }
  }

  /**
   * Processa evento específico
   */
  private async handleEvent(payload: CaktoWebhookPayload): Promise<void> {
    // Cria ou atualiza cliente (se dados disponíveis)
    let customer = null
    let customerId = undefined
    
    if (payload.customer?.phone) {
      customer = await this.customerService.findOrCreateFromWebhook(payload)
      customerId = customer.id
    }

    // Cria ou atualiza pedido
    const order = await this.orderService.createFromWebhook(payload, customerId)

    // Se evento de aprovação, cancela mensagens pendentes
    if (payload.event === "purchase_approved") {
      await this.messageService.cancelOrderMessages(order.id)
    }

    // Agenda mensagens dos fluxos apenas se temos customer com telefone
    if (customer) {
      // Busca fluxos ativos para este evento
      const flows = await this.flowService.findActiveByEventType(payload.event)

      // Agenda mensagens dos fluxos
      for (const flow of flows) {
        await this.messageService.scheduleFlowMessages(flow, customer, order)
      }
    }
  }

  /**
   * Reprocessa eventos com erro
   */
  async reprocessFailedEvents(limit = 10): Promise<number> {
    const failedEvents = await query<WebhookEvent>(
      `SELECT * FROM webhook_events 
       WHERE tenant_id = $1 
       AND processed = false 
       AND retry_count < 3
       ORDER BY created_at
       LIMIT $2`,
      [this.tenantId, limit],
    )

    let processed = 0

    for (const event of failedEvents) {
      try {
        await this.handleEvent(event.payload)
        await update("webhook_events", event.id, {
          processed: true,
          processed_at: new Date().toISOString(),
        })
        processed++
      } catch (error) {
        await update("webhook_events", event.id, {
          error_message: error instanceof Error ? error.message : "Unknown error",
          retry_count: event.retry_count + 1,
        })
      }
    }

    return processed
  }

  /**
   * Lista eventos recentes
   */
  async getRecentEvents(limit = 50): Promise<WebhookEvent[]> {
    return query<WebhookEvent>(
      `SELECT * FROM webhook_events 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [this.tenantId, limit],
    )
  }
}
