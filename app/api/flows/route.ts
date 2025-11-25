// =====================================================
// FLOWS API - CRUD de fluxos de mensagens
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { FlowService } from "@/lib/services/flow-service"
import type { ApiResponse, MessageFlow } from "@/lib/types"
import { z } from "zod"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

const CreateFlowSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  event_type: z.enum([
    "boleto_gerado",
    "pix_gerado",
    "picpay_gerado",
    "openfinance_nubank_gerado",
    "checkout_abandonment",
    "purchase_approved",
    "purchase_refused",
  ]),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
})

// GET - Lista todos os fluxos
export async function GET(): Promise<NextResponse<ApiResponse<MessageFlow[]>>> {
  try {
    const flowService = new FlowService(DEFAULT_TENANT_ID)
    const flows = await flowService.list()

    return NextResponse.json({
      success: true,
      data: flows,
    })
  } catch (error) {
    console.error("List flows error:", error)
    return NextResponse.json({ success: false, error: "Erro ao listar fluxos" }, { status: 500 })
  }
}

// POST - Cria novo fluxo
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<MessageFlow>>> {
  try {
    const body = await request.json()

    const validation = CreateFlowSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const flowService = new FlowService(DEFAULT_TENANT_ID)
    const flow = await flowService.createFlow(validation.data)

    return NextResponse.json({
      success: true,
      data: flow,
    })
  } catch (error) {
    console.error("Create flow error:", error)
    return NextResponse.json({ success: false, error: "Erro ao criar fluxo" }, { status: 500 })
  }
}
