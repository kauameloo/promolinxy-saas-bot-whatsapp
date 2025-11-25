// =====================================================
// LOGS API - Logs de mensagens
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { MessageService } from "@/lib/services/message-service"
import type { MessageLog, PaginatedResponse } from "@/lib/types"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(request: NextRequest): Promise<NextResponse<PaginatedResponse<MessageLog>>> {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const status = searchParams.get("status") || undefined

    const messageService = new MessageService(DEFAULT_TENANT_ID)
    const { logs, total } = await messageService.getLogs(page, limit, { status })

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("List logs error:", error)
    return NextResponse.json(
      { success: false, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } },
      { status: 500 },
    )
  }
}
