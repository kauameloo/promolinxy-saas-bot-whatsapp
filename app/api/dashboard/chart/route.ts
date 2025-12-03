// =====================================================
// DASHBOARD CHART - Dados do gráfico
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { AnalyticsService } from "@/lib/services/analytics-service"
import type { ApiResponse, ChartDataPoint } from "@/lib/types"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

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
    const errorMessage = error instanceof Error ? error.message : "Erro ao buscar dados do gráfico"
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? String(error) : undefined
    }, { status: 500 })
  }
}
