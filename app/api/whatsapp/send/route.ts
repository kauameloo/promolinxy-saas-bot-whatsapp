// =====================================================
// WHATSAPP SEND MESSAGE API
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { insert } from "@/lib/db"
import type { ApiResponse, MessageLog } from "@/lib/types"
import { z } from "zod"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

const SendMessageSchema = z.object({
  phone: z.string().min(10, "Telefone inválido"),
  message: z.string().min(1, "Mensagem é obrigatória"),
})

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<MessageLog>>> {
  try {
    const body = await request.json()

    const validation = SendMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const { phone, message } = validation.data

    // Em produção, usaria o WhatsApp Engine
    // const engine = whatsappManager.getEngine(DEFAULT_TENANT_ID);
    // const result = await engine.sendMessage({ to: phone, content: message });

    // Registra no log (simulação de envio bem-sucedido)
    const log = await insert<MessageLog>("message_logs", {
      tenant_id: DEFAULT_TENANT_ID,
      phone: phone.replace(/\D/g, ""),
      message_content: message,
      status: "sent",
      sent_at: new Date().toISOString(),
      metadata: JSON.stringify({}),
    })

    return NextResponse.json({
      success: true,
      data: log,
      message: "Mensagem enviada com sucesso",
    })
  } catch (error) {
    console.error("Send message error:", error)
    return NextResponse.json({ success: false, error: "Erro ao enviar mensagem" }, { status: 500 })
  }
}
