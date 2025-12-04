// =====================================================
// ORDER DETAILS API - Retorna detalhes completos do pedido
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { DEFAULT_TENANT_ID } from "@/lib/constants/config"
import { OrderService } from "@/lib/services/order-service"
import type { ApiResponse } from "@/lib/types"

// GET - Busca pedido por ID (alinhado ao padrão usado em flows)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = await params
    const tenantId = DEFAULT_TENANT_ID
    const service = new OrderService(tenantId)
    // findById ignora tenant em single-tenant
    let order = await service.findById(id)
    if (!order) {
      // Fallback adicional (caso algum ambiente ainda use filtro por tenant)
      order = await service.findByIdAnyTenant(id)
    }

    if (!order) {
      return NextResponse.json({ success: false, error: "Pedido não encontrado" }, { status: 404 })
    }

    // Optionally, include recent webhook event payload for this order by external_id
    // We keep API minimal; UI can fetch webhook_events separately if needed.
    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error("Get order details error:", error)
    return NextResponse.json({ success: false, error: "Erro ao buscar detalhes do pedido" }, { status: 500 })
  }
}
