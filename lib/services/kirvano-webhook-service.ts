// =====================================================
// KIRVANO WEBHOOK SERVICE - Processamento de webhooks Kirvano
// =====================================================

import { insert, query, update } from "@/lib/db"
import type { WebhookEvent, KirvanoWebhookPayload, CaktoEventType } from "@/lib/types"
import { CustomerService } from "./customer-service"
import { OrderService } from "./order-service"
import { FlowService } from "./flow-service"
import { MessageService } from "./message-service"

export class KirvanoWebhookService {
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
   * Maps Kirvano event to internal event type
   */
  private mapKirvanoEventToInternal(kirvanoEvent: string): CaktoEventType {
    const eventMap: Record<string, CaktoEventType> = {
      // Kirvano uppercase format
      "PIX_GENERATED": "pix_gerado",
      "BOLETO_GENERATED": "boleto_gerado",
      "CREDIT_CARD_GENERATED": "checkout_abandonment",
      "ORDER_CREATED": "checkout_abandonment",
      "ORDER_APPROVED": "purchase_approved",
      "ORDER_REFUSED": "purchase_refused",
      "ORDER_REFUNDED": "purchase_refused",
      "ORDER_CANCELLED": "purchase_refused",
      "PAYMENT_PENDING": "pix_gerado",
      "PAYMENT_APPROVED": "purchase_approved",
      "PAYMENT_REFUSED": "purchase_refused",
      "PAYMENT_REFUNDED": "purchase_refused",
      "CART_ABANDONED": "checkout_abandonment",
      "ABANDONED_CART": "checkout_abandonment",
      "CHECKOUT_ABANDONMENT": "checkout_abandonment",
      "PURCHASE_APPROVED": "purchase_approved",
      "PURCHASE_REFUSED": "purchase_refused",
      "SALE_APPROVED": "purchase_approved",
      "SALE_REFUSED": "purchase_refused",
      "SALE_REFUNDED": "purchase_refused",
      "SUBSCRIPTION_CREATED": "checkout_abandonment",
      "SUBSCRIPTION_CANCELLED": "purchase_refused",
    }

    const mappedEvent = eventMap[kirvanoEvent]
    if (!mappedEvent) {
      console.warn(`⚠ Unknown Kirvano event '${kirvanoEvent}', defaulting to 'checkout_abandonment'`)
    }
    return mappedEvent || "checkout_abandonment"
  }

  /**
   * Converts Kirvano payload to internal format (normalization)
   */
  private normalizeKirvanoPayload(payload: KirvanoWebhookPayload): any {
    return {
      event: this.mapKirvanoEventToInternal(payload.event),
      transaction_id: payload.transaction_id || payload.order_id,
      customer: payload.customer,
      product: payload.product,
      payment: payload.payment,
      metadata: {
        ...payload.metadata,
        original_event: payload.event,
        source: "kirvano",
      },
      timestamp: payload.timestamp || new Date().toISOString(),
    }
  }

  /**
   * Processa webhook da Kirvano
   */
  async processWebhook(payload: KirvanoWebhookPayload): Promise<WebhookEvent> {
    const isDebugMode = process.env.NODE_ENV === "development" || process.env.WEBHOOK_DEBUG_LOG === "true"

    // Log detalhado do payload recebido para debugging (apenas em development)
    if (isDebugMode) {
      console.log("=== KIRVANO WEBHOOK RECEIVED ===")
      console.log("Event Type:", payload.event)
      console.log("Order ID:", payload.order_id || "N/A")
      console.log("Transaction ID:", payload.transaction_id || "N/A")
      console.log("Customer Data:", JSON.stringify(payload.customer, null, 2))
      console.log("Product Data:", JSON.stringify(payload.product, null, 2))
      console.log("Payment Data:", JSON.stringify(payload.payment, null, 2))
      console.log("Metadata:", JSON.stringify(payload.metadata, null, 2))
      console.log("================================")
    } else {
      // Em produção, log apenas informações essenciais (sem dados sensíveis)
      console.log(
        `Kirvano webhook received: ${payload.event} - Order: ${payload.order_id || payload.transaction_id || "N/A"}`,
      )
    }

    // Registra o evento com tipo mapeado para compatibilidade interna
    const mappedEventType = this.mapKirvanoEventToInternal(payload.event)
    const event = await insert<WebhookEvent>("webhook_events", {
      tenant_id: this.tenantId,
      event_type: mappedEventType,
      source: "kirvano",
      payload: JSON.stringify(payload),
      processed: false,
      retry_count: 0,
    })

    try {
      // Normaliza payload para formato interno
      const normalizedPayload = this.normalizeKirvanoPayload(payload)

      // Processa baseado no tipo de evento
      await this.handleEvent(normalizedPayload, isDebugMode)

      // Marca como processado
      await update("webhook_events", event.id, {
        processed: true,
        processed_at: new Date().toISOString(),
      })

      if (isDebugMode) {
        console.log(`✓ Kirvano webhook ${event.id} processed successfully`)
      }
      return { ...event, processed: true }
    } catch (error) {
      // Registra erro
      console.error(`✗ Kirvano webhook ${event.id} processing failed:`, error)
      await update("webhook_events", event.id, {
        error_message: error instanceof Error ? error.message : "Unknown error",
        retry_count: event.retry_count + 1,
      })

      throw error
    }
  }

  /**
   * Processa evento específico (usa formato normalizado)
   */
  private async handleEvent(normalizedPayload: any, isDebugMode = false): Promise<void> {
    // Cria ou atualiza cliente (se dados disponíveis)
    let customer = null
    let customerId = null

    if (normalizedPayload.customer?.phone?.trim()) {
      if (isDebugMode) {
        console.log("Creating/updating customer with data:", {
          name: normalizedPayload.customer.name,
          email: normalizedPayload.customer.email,
          phone: normalizedPayload.customer.phone,
          document: normalizedPayload.customer.document,
        })
      }
      customer = await this.customerService.findOrCreateFromWebhook(normalizedPayload, isDebugMode)
      customerId = customer.id
      if (isDebugMode) {
        console.log(`✓ Customer processed: ${customer.name} (${customer.id})`)
      }
    } else {
      console.warn("⚠ No customer phone found in Kirvano webhook payload - skipping customer creation")
    }

    // Cria ou atualiza pedido
    if (isDebugMode) {
      console.log("Creating/updating order with data:", {
        transaction_id: normalizedPayload.transaction_id,
        product_name: normalizedPayload.product?.name,
        product_id: normalizedPayload.product?.id,
        amount: normalizedPayload.payment?.amount || normalizedPayload.product?.price,
        payment_method: normalizedPayload.payment?.method,
        event: normalizedPayload.event,
      })
    }
    const order = await this.orderService.createFromWebhook(normalizedPayload, customerId, isDebugMode)
    if (isDebugMode) {
      console.log(`✓ Order processed: ${order.id}`)
    }

    // Se evento de aprovação, cancela mensagens pendentes
    if (normalizedPayload.event === "purchase_approved") {
      if (isDebugMode) {
        console.log("Purchase approved - canceling pending messages")
      }
      await this.messageService.cancelOrderMessages(order.id)
    }

    // Agenda mensagens dos fluxos apenas se temos customer com telefone
    if (customer) {
      // Busca fluxos ativos para este evento
      const flows = await this.flowService.findActiveByEventType(normalizedPayload.event)
      if (isDebugMode) {
        console.log(`Found ${flows.length} active flow(s) for event ${normalizedPayload.event}`)
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
       AND source = 'kirvano'
       AND processed = false 
       AND retry_count < 3
       ORDER BY created_at
       LIMIT $2`,
      [this.tenantId, limit],
    )

    let processed = 0

    for (const event of failedEvents) {
      try {
        const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload
        const normalizedPayload = this.normalizeKirvanoPayload(payload)
        await this.handleEvent(normalizedPayload)
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
   * Lista eventos recentes da Kirvano
   */
  async getRecentEvents(limit = 50): Promise<WebhookEvent[]> {
    return query<WebhookEvent>(
      `SELECT * FROM webhook_events 
       WHERE tenant_id = $1 
       AND source = 'kirvano'
       ORDER BY created_at DESC 
       LIMIT $2`,
      [this.tenantId, limit],
    )
  }
}
