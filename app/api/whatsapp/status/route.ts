// =====================================================
// WHATSAPP STATUS API
// =====================================================

import { NextResponse } from "next/server"
import { queryOne, update } from "@/lib/db"
import type { WhatsAppSession, ApiResponse } from "@/lib/types"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(): Promise<NextResponse<ApiResponse<WhatsAppSession>>> {
  try {
    const session = await queryOne<WhatsAppSession>(`SELECT * FROM whatsapp_sessions WHERE tenant_id = $1 LIMIT 1`, [
      DEFAULT_TENANT_ID,
    ])

    if (!session) {
      return NextResponse.json({
        success: true,
        data: {
          id: "",
          tenant_id: DEFAULT_TENANT_ID,
          session_name: "principal",
          status: "disconnected",
          created_at: new Date(),
          updated_at: new Date(),
        } as WhatsAppSession,
      })
    }

    return NextResponse.json({
      success: true,
      data: session,
    })
  } catch (error) {
    console.error("WhatsApp status error:", error)
    return NextResponse.json({ success: false, error: "Erro ao buscar status" }, { status: 500 })
  }
}

export async function POST(): Promise<NextResponse<ApiResponse>> {
  try {
    // Simula conexão - Em produção, iniciaria o whatsapp-web.js
    const session = await queryOne<WhatsAppSession>(`SELECT * FROM whatsapp_sessions WHERE tenant_id = $1 LIMIT 1`, [
      DEFAULT_TENANT_ID,
    ])

    if (session) {
      await update("whatsapp_sessions", session.id, {
        status: "qr_ready",
        qr_code: "DEMO_QR_CODE_" + Date.now(),
      })
    }

    return NextResponse.json({
      success: true,
      message: "Conexão iniciada. Aguarde o QR Code.",
    })
  } catch (error) {
    console.error("WhatsApp connect error:", error)
    return NextResponse.json({ success: false, error: "Erro ao conectar" }, { status: 500 })
  }
}
