// =====================================================
// DASHBOARD EVENTS BY TYPE - Contagem de eventos por tipo
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { AnalyticsService } from "@/lib/services/analytics-service"
import type { ApiResponse } from "@/lib/types"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Record<string, number>>>> {
  try {
    const { searchParams } = new URL(request.url)
    const days = Number.parseInt(searchParams.get("days") || "30")

    const analyticsService = new AnalyticsService(DEFAULT_TENANT_ID)
    const eventsByType = await analyticsService.getEventsByType(days)

    return NextResponse.json({
      success: true,
      data: eventsByType,
    })
  } catch (error) {
    console.error("Dashboard events by type error:", error)
    return NextResponse.json({ success: false, error: "Erro ao buscar eventos por tipo" }, { status: 500 })
  }
}
