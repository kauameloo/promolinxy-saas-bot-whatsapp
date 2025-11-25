// =====================================================
// WEBHOOK CAKTO - Endpoint para receber eventos
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"
import { verifyWebhookSignature } from "@/lib/utils/crypto"
import type { CaktoWebhookPayload, ApiResponse } from "@/lib/types"
import { z } from "zod"

// Schema de validação do payload
const CaktoPayloadSchema = z.object({
  event: z.enum([
    "boleto_gerado",
    "pix_gerado",
    "picpay_gerado",
    "openfinance_nubank_gerado",
    "checkout_abandonment",
    "purchase_approved",
    "purchase_refused",
  ]),
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
    let payload: CaktoWebhookPayload

    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 })
    }

    // Verifica assinatura (se configurada)
    const signature = request.headers.get("x-cakto-signature") || request.headers.get("x-webhook-signature")
    const webhookSecret = process.env.CAKTO_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error("Invalid webhook signature")
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 })
      }
    }

    // Valida payload com Zod
    const validationResult = CaktoPayloadSchema.safeParse(payload)
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors)
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
    const webhookService = new WebhookService(tenantId)
    const event = await webhookService.processWebhook(validationResult.data)

    console.log(`Webhook processed: ${event.event_type} - ${event.id}`)

    return NextResponse.json({
      success: true,
      data: { eventId: event.id },
      message: `Event ${event.event_type} processed successfully`,
    })
  } catch (error) {
    console.error("Webhook processing error:", error)
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
    message: "Cakto webhook endpoint is active",
    data: {
      supportedEvents: [
        "boleto_gerado",
        "pix_gerado",
        "picpay_gerado",
        "openfinance_nubank_gerado",
        "checkout_abandonment",
        "purchase_approved",
        "purchase_refused",
      ],
    },
  })
}
