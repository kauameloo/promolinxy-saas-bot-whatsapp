// =====================================================
// FLOW MESSAGES REORDER - Reordena mensagens de um fluxo
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { FlowService } from "@/lib/services/flow-service"
import type { ApiResponse } from "@/lib/types"
import { z } from "zod"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

const ReorderSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1, "Lista de mensagens vazia"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = ReorderSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const flowService = new FlowService(DEFAULT_TENANT_ID)
    await flowService.reorderMessages(id, validation.data.messageIds)

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error("Reorder flow messages error:", error)
    return NextResponse.json({ success: false, error: "Erro ao reordenar mensagens" }, { status: 500 })
  }
}
