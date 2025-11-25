// =====================================================
// WHATSAPP SEND MESSAGE API
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { insert } from "@/lib/db"
import type { ApiResponse, MessageLog } from "@/lib/types"
import { z } from "zod"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

const SendMessageSchema = z.object({
  phone: z.string().min(10, "Telefone inválido"),
  message: z.string().min(1, "Mensagem é obrigatória"),
})

// Timeout for WhatsApp Engine requests (10 seconds)
const ENGINE_REQUEST_TIMEOUT_MS = 10000

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<MessageLog>>> {
  try {
    const body = await request.json()

    const validation = SendMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const { phone, message } = validation.data
    const cleanPhone = phone.replace(/\D/g, "")

    // Try to send via WhatsApp Engine backend
    const engineUrl = process.env.WHATSAPP_ENGINE_URL || "http://localhost:3001"
    let sendResult = { success: false, error: "WhatsApp Engine não disponível", messageId: "" }

    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ENGINE_REQUEST_TIMEOUT_MS)

      const resp = await fetch(`${engineUrl.replace(/\/$/, "")}/api/whatsapp/send/${DEFAULT_TENANT_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: cleanPhone, content: message }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle different HTTP status codes
      if (resp.status === 404) {
        sendResult = { success: false, error: "WhatsApp não está conectado. Conecte primeiro na página de WhatsApp.", messageId: "" }
      } else if (resp.status >= 500) {
        sendResult = { success: false, error: "Erro interno no servidor WhatsApp. Tente novamente.", messageId: "" }
      } else {
        const data = await resp.json()
        if (data.success) {
          sendResult = { success: true, error: "", messageId: data.data?.messageId || "" }
        } else {
          sendResult = { success: false, error: data.error || "Erro ao enviar mensagem", messageId: "" }
        }
      }
    } catch (err) {
      console.error("Error contacting WhatsApp engine:", err)
      
      // Handle specific error types
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          sendResult = { success: false, error: "Tempo limite excedido ao conectar com o servidor WhatsApp.", messageId: "" }
        } else if (err.message.includes('ECONNREFUSED')) {
          sendResult = { success: false, error: "WhatsApp Engine não está rodando. Verifique se o servidor backend está ativo.", messageId: "" }
        } else {
          sendResult = { success: false, error: "Erro de conexão com o WhatsApp Engine. Verifique se o servidor está rodando.", messageId: "" }
        }
      } else {
        sendResult = { success: false, error: "WhatsApp Engine não disponível. Verifique se o servidor está rodando.", messageId: "" }
      }
    }

    // Log the message with actual status
    const log = await insert<MessageLog>("message_logs", {
      tenant_id: DEFAULT_TENANT_ID,
      phone: cleanPhone,
      message_content: message,
      status: sendResult.success ? "sent" : "failed",
      sent_at: sendResult.success ? new Date().toISOString() : null,
      error_message: sendResult.success ? null : sendResult.error,
      metadata: JSON.stringify({ messageId: sendResult.messageId }),
    })

    if (!sendResult.success) {
      return NextResponse.json({
        success: false,
        error: sendResult.error,
        data: log,
      }, { status: 400 })
    }

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
