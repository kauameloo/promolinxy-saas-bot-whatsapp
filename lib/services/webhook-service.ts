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
    const isDebugMode = process.env.NODE_ENV === "development" || process.env.WEBHOOK_DEBUG_LOG === "true"
    
    // Log detalhado do payload recebido para debugging (apenas em development)
    if (isDebugMode) {
      console.log("=== CAKTO WEBHOOK RECEIVED ===")
      console.log("Event Type:", payload.event)
      console.log("Transaction ID:", payload.transaction_id || "N/A")
      console.log("Customer Data:", JSON.stringify(payload.customer, null, 2))
      console.log("Product Data:", JSON.stringify(payload.product, null, 2))
      console.log("Payment Data:", JSON.stringify(payload.payment, null, 2))
      console.log("Metadata:", JSON.stringify(payload.metadata, null, 2))
      console.log("==============================")
    } else {
      // Em produção, log apenas informações essenciais (sem dados sensíveis)
      console.log(`Webhook received: ${payload.event} - Transaction: ${payload.transaction_id || "N/A"}`)
    }

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
      await this.handleEvent(payload, isDebugMode)

      // Marca como processado
      await update("webhook_events", event.id, {
        processed: true,
        processed_at: new Date().toISOString(),
      })

      if (isDebugMode) {
        console.log(`✓ Webhook ${event.id} processed successfully`)
      }
      return { ...event, processed: true }
    } catch (error) {
      // Registra erro
      console.error(`✗ Webhook ${event.id} processing failed:`, error)
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
  private async handleEvent(payload: CaktoWebhookPayload, isDebugMode = false): Promise<void> {
    // Cria ou atualiza cliente (se dados disponíveis)
    let customer = null
    let customerId = null
    
    if (payload.customer?.phone?.trim()) {
      if (isDebugMode) {
        console.log("Creating/updating customer with data:", {
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone,
          document: payload.customer.document,
        })
      }
      customer = await this.customerService.findOrCreateFromWebhook(payload, isDebugMode)
      customerId = customer.id
      if (isDebugMode) {
        console.log(`✓ Customer processed: ${customer.name} (${customer.id})`)
      }
    } else {
      console.warn("⚠ No customer phone found in webhook payload - skipping customer creation")
    }

    // Cria ou atualiza pedido
    if (isDebugMode) {
      console.log("Creating/updating order with data:", {
        transaction_id: payload.transaction_id,
        product_name: payload.product?.name,
        product_id: payload.product?.id,
        amount: payload.payment?.amount || payload.product?.price,
        payment_method: payload.payment?.method,
        event: payload.event,
      })
    }
    const order = await this.orderService.createFromWebhook(payload, customerId, isDebugMode)
    if (isDebugMode) {
      console.log(`✓ Order processed: ${order.id}`)
    }

    // Se evento de aprovação, cancela mensagens pendentes
    if (payload.event === "purchase_approved") {
      if (isDebugMode) {
        console.log("Purchase approved - canceling pending messages")
      }
      await this.messageService.cancelOrderMessages(order.id)
    }

    // Agenda mensagens dos fluxos apenas se temos customer com telefone
    if (customer) {
      // Busca fluxos ativos para este evento
      const flows = await this.flowService.findActiveByEventType(payload.event)
      if (isDebugMode) {
        console.log(`Found ${flows.length} active flow(s) for event ${payload.event}`)
      }

      // Agenda mensagens dos fluxos
      for (const flow of flows) {
        const scheduled = await this.messageService.scheduleFlowMessages(flow, customer, order, isDebugMode)
        if (isDebugMode) {
          console.log(`✓ Scheduled ${scheduled.length} message(s) from flow "${flow.name}"`)
        }
      }
    } else {
      console.warn("⚠ No customer available - skipping message scheduling")
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
