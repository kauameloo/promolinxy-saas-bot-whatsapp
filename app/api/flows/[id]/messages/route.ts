// =====================================================
// FLOW MESSAGES - Mensagens de um fluxo
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { FlowService } from "@/lib/services/flow-service"
import type { ApiResponse, FlowMessage } from "@/lib/types"
import { z } from "zod"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

const AddMessageSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
  delay_minutes: z.number().min(0, "Delay não pode ser negativo"),
  message_order: z.number().optional(),
  media_url: z.string().url().optional(),
  media_type: z.enum(["image", "video", "audio", "document"]).optional(),
})

// GET - Lista mensagens do fluxo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<FlowMessage[]>>> {
  try {
    const { id } = await params
    const flowService = new FlowService(DEFAULT_TENANT_ID)
    const messages = await flowService.getFlowMessages(id)

    return NextResponse.json({
      success: true,
      data: messages,
    })
  } catch (error) {
    console.error("List flow messages error:", error)
    return NextResponse.json({ success: false, error: "Erro ao listar mensagens" }, { status: 500 })
  }
}

// POST - Adiciona mensagem ao fluxo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<FlowMessage>>> {
  try {
    const { id } = await params
    const body = await request.json()

    const validation = AddMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const flowService = new FlowService(DEFAULT_TENANT_ID)
    const message = await flowService.addMessage(id, validation.data)

    return NextResponse.json({
      success: true,
      data: message,
    })
  } catch (error) {
    console.error("Add flow message error:", error)
    return NextResponse.json({ success: false, error: "Erro ao adicionar mensagem" }, { status: 500 })
  }
}
