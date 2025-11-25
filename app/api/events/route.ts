// =====================================================
// EVENTS API - Eventos de webhook
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"
import type { ApiResponse, WebhookEvent } from "@/lib/types"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<WebhookEvent[]>>> {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    const webhookService = new WebhookService(DEFAULT_TENANT_ID)
    const events = await webhookService.getRecentEvents(limit)

    return NextResponse.json({
      success: true,
      data: events,
    })
  } catch (error) {
    console.error("List events error:", error)
    return NextResponse.json({ success: false, error: "Erro ao listar eventos" }, { status: 500 })
  }
}
