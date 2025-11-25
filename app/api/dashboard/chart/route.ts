// =====================================================
// DASHBOARD CHART - Dados do gráfico
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { AnalyticsService } from "@/lib/services/analytics-service"
import type { ApiResponse, ChartDataPoint } from "@/lib/types"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<ChartDataPoint[]>>> {
  try {
    const { searchParams } = new URL(request.url)
    const days = Number.parseInt(searchParams.get("days") || "7")

    const analyticsService = new AnalyticsService(DEFAULT_TENANT_ID)
    const chartData = await analyticsService.getMessageChartData(days)

    return NextResponse.json({
      success: true,
      data: chartData,
    })
  } catch (error) {
    console.error("Dashboard chart error:", error)
    return NextResponse.json({ success: false, error: "Erro ao buscar dados do gráfico" }, { status: 500 })
  }
}
