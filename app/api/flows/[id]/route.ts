// =====================================================
// FLOW BY ID - Operações em fluxo específico
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { FlowService } from "@/lib/services/flow-service"
import type { ApiResponse, MessageFlow } from "@/lib/types"
import { z } from "zod"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

const UpdateFlowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
})

// GET - Busca fluxo por ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<MessageFlow>>> {
  try {
    const { id } = await params
    const flowService = new FlowService(DEFAULT_TENANT_ID)
    const flow = await flowService.findById(id)

    if (!flow) {
      return NextResponse.json({ success: false, error: "Fluxo não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: flow,
    })
  } catch (error) {
    console.error("Get flow error:", error)
    return NextResponse.json({ success: false, error: "Erro ao buscar fluxo" }, { status: 500 })
  }
}

// PUT - Atualiza fluxo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<MessageFlow>>> {
  try {
    const { id } = await params
    const body = await request.json()

    const validation = UpdateFlowSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const flowService = new FlowService(DEFAULT_TENANT_ID)
    const flow = await flowService.updateFlow(id, validation.data)

    if (!flow) {
      return NextResponse.json({ success: false, error: "Fluxo não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: flow,
    })
  } catch (error) {
    console.error("Update flow error:", error)
    return NextResponse.json({ success: false, error: "Erro ao atualizar fluxo" }, { status: 500 })
  }
}

// DELETE - Remove fluxo
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = await params
    const flowService = new FlowService(DEFAULT_TENANT_ID)
    await flowService.deleteFlow(id)

    return NextResponse.json({
      success: true,
      message: "Fluxo removido com sucesso",
    })
  } catch (error) {
    console.error("Delete flow error:", error)
    return NextResponse.json({ success: false, error: "Erro ao remover fluxo" }, { status: 500 })
  }
}
