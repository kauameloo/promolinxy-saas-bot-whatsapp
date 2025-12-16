// =====================================================
// WEBHOOK KIRVANO - Endpoint para receber eventos
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { KirvanoWebhookService } from "@/lib/services/kirvano-webhook-service"
import { verifyWebhookSignature } from "@/lib/utils/crypto"
import type { KirvanoWebhookPayload, ApiResponse } from "@/lib/types"
import { z } from "zod"

// Schema de validação do payload
const KirvanoPayloadSchema = z.object({
  event: z.enum([
    "ORDER_CREATED",
    "ORDER_APPROVED",
    "ORDER_REFUSED",
    "ORDER_REFUNDED",
    "ORDER_CANCELLED",
    "PAYMENT_PENDING",
    "PAYMENT_APPROVED",
    "PAYMENT_REFUSED",
    "PAYMENT_REFUNDED",
    "CART_ABANDONED",
    "ABANDONED_CART",
    "PIX_GENERATED",
    "BOLETO_GENERATED",
    "CREDIT_CARD_GENERATED",
    "PURCHASE_APPROVED",
    "PURCHASE_REFUSED",
    "CHECKOUT_ABANDONMENT",
    // Additional common variations
    "SALE_APPROVED",
    "SALE_REFUSED",
    "SALE_REFUNDED",
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_CANCELLED",
  ]),
  order_id: z.string().optional(),
  transaction_id: z.string().optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      document: z.string().optional(),
    })
    .optional(),
  product: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      price: z.number().optional(),
    })
    .optional(),
  payment: z
    .object({
      method: z.string().optional(),
      amount: z.number().optional(),
      status: z.string().optional(),
      boleto_url: z.string().optional(),
      pix_code: z.string().optional(),
      pix_qrcode: z.string().optional(),
      checkout_url: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
})

// Tenant padrão (em produção, viria de header ou API key)
import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Lê o body como texto para verificação de assinatura
    const rawBody = await request.text()
    let payload: KirvanoWebhookPayload

    try {
      const raw = JSON.parse(rawBody)

      // Se o payload da Kirvano vem com estrutura aninhada, mapeia para nossa estrutura
      if (raw && typeof raw === "object" && raw.data) {
        const d = raw.data

        // Mapeia estrutura da Kirvano para nossa estrutura interna
        const mapped: KirvanoWebhookPayload = {
          event: raw.event,
          order_id: d.orderId || d.order_id || d.id || undefined,
          transaction_id: d.transactionId || d.transaction_id || d.refId || undefined,
          customer: d.customer && (d.customer.phone || d.customer.cellphone || d.customer.celular || d.customer.mobile || d.customer.telefone)
            ? {
                name: d.customer.name || "",
                email: d.customer.email || undefined,
                phone: String(d.customer.phone || d.customer.cellphone || d.customer.celular || d.customer.mobile || d.customer.telefone),
                document: d.customer.document || d.customer.docNumber || undefined,
              }
            : undefined,
          product: d.product
            ? {
                id: String(d.product.id || d.product.short_id || ""),
                name: String(d.product.name || "Produto"),
                price: d.product.price || d.amount || d.baseAmount || 0,
              }
            : undefined,
          payment:
            d.payment || d.paymentMethod || d.amount || d.pix || d.boleto
              ? {
                  method: d.payment?.method || d.paymentMethod || "",
                  amount: d.payment?.amount || d.amount || d.baseAmount || 0,
                  status: d.payment?.status || d.status || "",
                  boleto_url: d.payment?.boletoUrl || d.boleto?.boletoUrl || undefined,
                  pix_code: d.payment?.pixCode || d.pix?.qrCode || undefined,
                  pix_qrcode: d.payment?.pixQrCode || d.pix?.qrCode || undefined,
                  checkout_url: d.payment?.checkoutUrl || d.checkoutUrl || undefined,
                }
              : undefined,
          metadata: {
            ...d.metadata,
            affiliate: d.affiliate,
            fees: d.fees,
            discount: d.discount,
            installments: d.installments,
            utm_source: d.utm_source,
            utm_medium: d.utm_medium,
            utm_campaign: d.utm_campaign,
            utm_term: d.utm_term,
            utm_content: d.utm_content,
          },
          timestamp: d.timestamp || d.createdAt || new Date().toISOString(),
        }

        payload = mapped
      } else {
        // Handle flat structure - map customer, product, payment fields
        const mapped: KirvanoWebhookPayload = {
          event: raw.event,
          order_id: raw.orderId || raw.order_id || raw.id || undefined,
          transaction_id: raw.transactionId || raw.transaction_id || raw.refId || undefined,
          customer: raw.customer && (raw.customer.phone || raw.customer.cellphone || raw.customer.celular || raw.customer.mobile || raw.customer.telefone)
            ? {
                name: raw.customer.name || "",
                email: raw.customer.email || undefined,
                phone: String(raw.customer.phone || raw.customer.cellphone || raw.customer.celular || raw.customer.mobile || raw.customer.telefone),
                document: raw.customer.document || raw.customer.docNumber || undefined,
              }
            : undefined,
          product: raw.product
            ? {
                id: String(raw.product.id || raw.product.short_id || ""),
                name: String(raw.product.name || "Produto"),
                price: raw.product.price || raw.amount || raw.baseAmount || 0,
              }
            : undefined,
          payment:
            raw.payment || raw.paymentMethod || raw.amount || raw.pix || raw.boleto
              ? {
                  method: raw.payment?.method || raw.paymentMethod || "",
                  amount: raw.payment?.amount || raw.amount || raw.baseAmount || 0,
                  status: raw.payment?.status || raw.status || "",
                  boleto_url: raw.payment?.boletoUrl || raw.boleto?.boletoUrl || undefined,
                  pix_code: raw.payment?.pixCode || raw.pix?.qrCode || undefined,
                  pix_qrcode: raw.payment?.pixQrCode || raw.pix?.qrCode || undefined,
                  checkout_url: raw.payment?.checkoutUrl || raw.checkoutUrl || undefined,
                }
              : undefined,
          metadata: {
            ...raw.metadata,
            affiliate: raw.affiliate,
            fees: raw.fees,
            discount: raw.discount,
            installments: raw.installments,
            utm_source: raw.utm_source,
            utm_medium: raw.utm_medium,
            utm_campaign: raw.utm_campaign,
            utm_term: raw.utm_term,
            utm_content: raw.utm_content,
          },
          timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
        }

        payload = mapped
      }

      // Debug logging para identificar problemas com customer data
      if (process.env.NODE_ENV === "development" || process.env.WEBHOOK_DEBUG_LOG === "true") {
        if (payload.customer) {
          console.log("✓ Customer data extracted:", {
            name: payload.customer.name,
            phone: payload.customer.phone,
            email: payload.customer.email,
          })
        } else {
          console.log("⚠ No customer data extracted. Raw customer object:", JSON.stringify((JSON.parse(rawBody)).customer, null, 2))
        }
      }
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 })
    }

    // Verifica assinatura (se configurada)
    const signature = request.headers.get("x-kirvano-signature") || request.headers.get("x-webhook-signature")
    const webhookSecret = process.env.KIRVANO_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error("Invalid Kirvano webhook signature")
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 })
      }
    }

    // Valida payload com Zod
    const validationResult = KirvanoPayloadSchema.safeParse(payload)
    if (!validationResult.success) {
      console.error("Kirvano validation error:", validationResult.error.errors)
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload structure",
          message: validationResult.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 },
      )
    }

    // Extrai tenant ID (do header ou usa padrão)
    const tenantId = request.headers.get("x-tenant-id") || DEFAULT_TENANT_ID

    // Processa o webhook
    const webhookService = new KirvanoWebhookService(tenantId)
    const event = await webhookService.processWebhook(validationResult.data)

    console.log(`Kirvano webhook processed: ${event.event_type} - ${event.id}`)

    return NextResponse.json({
      success: true,
      data: { eventId: event.id },
      message: `Event ${event.event_type} processed successfully`,
    })
  } catch (error) {
    console.error("Kirvano webhook processing error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}

// Health check
export async function GET(): Promise<NextResponse<ApiResponse>> {
  return NextResponse.json({
    success: true,
    message: "Kirvano webhook endpoint is active",
    data: {
      supportedEvents: [
        "PIX_GENERATED",
        "BOLETO_GENERATED",
        "CREDIT_CARD_GENERATED",
        "ORDER_CREATED",
        "ORDER_APPROVED",
        "ORDER_REFUSED",
        "ORDER_REFUNDED",
        "ORDER_CANCELLED",
        "PAYMENT_PENDING",
        "PAYMENT_APPROVED",
        "PAYMENT_REFUSED",
        "PAYMENT_REFUNDED",
        "CART_ABANDONED",
        "ABANDONED_CART",
        "CHECKOUT_ABANDONMENT",
        "PURCHASE_APPROVED",
        "PURCHASE_REFUSED",
        "SALE_APPROVED",
        "SALE_REFUSED",
        "SALE_REFUNDED",
        "SUBSCRIPTION_CREATED",
        "SUBSCRIPTION_CANCELLED",
      ],
    },
  })
}
