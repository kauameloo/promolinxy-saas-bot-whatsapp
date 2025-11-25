// =====================================================
// CUSTOMERS API - Lista de clientes
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { CustomerService } from "@/lib/services/customer-service"
import type { Customer, PaginatedResponse } from "@/lib/types"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(request: NextRequest): Promise<NextResponse<PaginatedResponse<Customer>>> {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    const customerService = new CustomerService(DEFAULT_TENANT_ID)
    const { customers, total } = await customerService.list(page, limit)

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("List customers error:", error)
    return NextResponse.json(
      { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      { status: 500 },
    )
  }
}
