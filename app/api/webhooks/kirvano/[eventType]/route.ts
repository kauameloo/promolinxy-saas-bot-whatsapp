// =====================================================
// WEBHOOK KIRVANO PER EVENT TYPE - Endpoint para evento específico
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"
import { verifyWebhookSignature } from "@/lib/utils/crypto"
import type { KirvanoWebhookPayload, ApiResponse, KirvanoEventType } from "@/lib/types"
import { z } from "zod"
import { KIRVANO_SUPPORTED_EVENTS, KIRVANO_EVENT_LABELS } from "@/lib/constants/default-flows"
import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

// Schema de validação do payload (sem event obrigatório - vem da URL)
const KirvanoPayloadSchema = z.object({
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventType: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const { eventType } = await params

    // Validate event type
    if (!KIRVANO_SUPPORTED_EVENTS.includes(eventType as KirvanoEventType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid event type: ${eventType}`,
          message: `Supported events: ${KIRVANO_SUPPORTED_EVENTS.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Lê o body como texto para verificação de assinatura
    const rawBody = await request.text()
    let payload: Partial<KirvanoWebhookPayload>

    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 })
    }

    // Verifica assinatura (se configurada)
    // Supports both "x-kirvano-signature" (Kirvano-specific) and generic "x-webhook-signature" headers
    // to provide flexibility for different webhook sources and configurations
    const signature = request.headers.get("x-kirvano-signature") || request.headers.get("x-webhook-signature")
    const webhookSecret = process.env.KIRVANO_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error("Invalid webhook signature")
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 })
      }
    }

    // Valida payload com Zod
    const validationResult = KirvanoPayloadSchema.safeParse(payload)
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors)
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload structure",
          message: validationResult.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      )
    }

    // Extrai tenant ID (do header ou usa padrão)
    const tenantId = request.headers.get("x-tenant-id") || DEFAULT_TENANT_ID

    // Add the event type from URL to payload
    const fullPayload: KirvanoWebhookPayload = {
      ...validationResult.data,
      event: eventType as KirvanoEventType,
    }

    console.log(`Processing webhook for event: ${eventType}`)
    console.log(`Tenant ID: ${tenantId}`)
    console.log(`Has customer data: ${!!fullPayload.customer}`)
    console.log(`Has product data: ${!!fullPayload.product}`)
    console.log(`Has payment data: ${!!fullPayload.payment}`)

    // Processa o webhook
    const webhookService = new WebhookService(tenantId)
    const event = await webhookService.processKirvanoWebhook(fullPayload)

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
      { status: 500 }
    )
  }
}

// Health check for specific event
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventType: string }> }
): Promise<NextResponse<ApiResponse>> {
  const { eventType } = await params

  if (!KIRVANO_SUPPORTED_EVENTS.includes(eventType as KirvanoEventType)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid event type: ${eventType}`,
        message: `Supported events: ${KIRVANO_SUPPORTED_EVENTS.join(", ")}`,
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    message: `Webhook endpoint for event "${KIRVANO_EVENT_LABELS[eventType as KirvanoEventType]}" is active`,
    data: {
      eventType,
      eventLabel: KIRVANO_EVENT_LABELS[eventType as KirvanoEventType],
    },
  })
}
