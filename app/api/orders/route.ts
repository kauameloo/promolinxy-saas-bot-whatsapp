// =====================================================
// ORDERS API - Lista de pedidos
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { OrderService } from "@/lib/services/order-service"
import type { Order, PaginatedResponse, OrderStatus } from "@/lib/types"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(request: NextRequest): Promise<NextResponse<PaginatedResponse<Order>>> {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const status = searchParams.get("status") as OrderStatus | null

    const orderService = new OrderService(DEFAULT_TENANT_ID)
    const { orders, total } = await orderService.list(page, limit, status || undefined)

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("List orders error:", error)
    return NextResponse.json(
      { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      { status: 500 },
    )
  }
}
