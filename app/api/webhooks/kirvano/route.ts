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
    "order.created",
    "order.approved",
    "order.refused",
    "order.refunded",
    "order.cancelled",
    "payment.pending",
    "payment.approved",
    "payment.refused",
    "payment.refunded",
    "cart.abandoned",
  ]),
  order_id: z.string().optional(),
  transaction_id: z.string().optional(),
  customer: z
    .object({
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string(),
      document: z.string().optional(),
    })
    .optional(),
  product: z
    .object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
    })
    .optional(),
  payment: z
    .object({
      method: z.string(),
      amount: z.number(),
      status: z.string(),
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
          customer: d.customer && (d.customer.phone || d.customer.cellphone)
            ? {
                name: d.customer.name || "",
                email: d.customer.email || undefined,
                phone: String(d.customer.phone || d.customer.cellphone),
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
          payment: d.payment
            ? {
                method: d.payment.method || d.paymentMethod || "",
                amount: d.payment.amount || d.amount || d.baseAmount || 0,
                status: d.payment.status || d.status || "",
                boleto_url: d.payment.boletoUrl || d.boleto?.boletoUrl || undefined,
                pix_code: d.payment.pixCode || d.pix?.qrCode || undefined,
                pix_qrcode: d.payment.pixQrCode || d.pix?.qrCode || undefined,
                checkout_url: d.payment.checkoutUrl || d.checkoutUrl || undefined,
              }
            : {
                method: d.paymentMethod || "",
                amount: d.amount || d.baseAmount || 0,
                status: d.status || "",
                boleto_url: d.boleto?.boletoUrl || undefined,
                pix_code: d.pix?.qrCode || undefined,
                pix_qrcode: d.pix?.qrCode || undefined,
                checkout_url: d.checkoutUrl || undefined,
              },
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
        payload = raw as KirvanoWebhookPayload
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
        "order.created",
        "order.approved",
        "order.refused",
        "order.refunded",
        "order.cancelled",
        "payment.pending",
        "payment.approved",
        "payment.refused",
        "payment.refunded",
        "cart.abandoned",
      ],
    },
  })
}
