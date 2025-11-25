// =====================================================
// DASHBOARD STATS - Estatísticas do dashboard
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { AnalyticsService } from "@/lib/services/analytics-service"
import { verifyJWT } from "@/lib/utils/crypto"
import type { JWTPayload, ApiResponse, DashboardStats } from "@/lib/types"

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production"
import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<DashboardStats>>> {
  try {
    // Tenta autenticar (opcional para desenvolvimento)
    let tenantId = DEFAULT_TENANT_ID

    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7)
      const { valid, payload } = verifyJWT<JWTPayload>(token, JWT_SECRET)
      if (valid && payload) {
        tenantId = payload.tenantId
      }
    }

    const analyticsService = new AnalyticsService(tenantId)
    const stats = await analyticsService.getDashboardStats()

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json({ success: false, error: "Erro ao buscar estatísticas" }, { status: 500 })
  }
}
