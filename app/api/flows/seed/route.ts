// =====================================================
// SEED FLOWS - Cria fluxos padrão
// =====================================================

import { NextResponse } from "next/server"
import { FlowService } from "@/lib/services/flow-service"
import { DEFAULT_FLOWS } from "@/lib/constants/default-flows"
import type { ApiResponse } from "@/lib/types"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

export async function POST(): Promise<NextResponse<ApiResponse>> {
  try {
    const flowService = new FlowService(DEFAULT_TENANT_ID)

    // Verifica se já existem fluxos
    const existingFlows = await flowService.list()
    if (existingFlows.length > 0) {
      return NextResponse.json({
        success: true,
        message: `Já existem ${existingFlows.length} fluxos configurados`,
      })
    }

    // Cria fluxos padrão
    for (const defaultFlow of DEFAULT_FLOWS) {
      const flow = await flowService.createFlow({
        name: defaultFlow.name,
        event_type: defaultFlow.event_type,
        description: defaultFlow.description,
        is_active: true,
      })

      // Adiciona mensagens
      for (const msg of defaultFlow.messages) {
        await flowService.addMessage(flow.id, {
          content: msg.content,
          delay_minutes: msg.delay_minutes,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${DEFAULT_FLOWS.length} fluxos criados com sucesso`,
    })
  } catch (error) {
    console.error("Seed flows error:", error)
    return NextResponse.json({ success: false, error: "Erro ao criar fluxos padrão" }, { status: 500 })
  }
}
