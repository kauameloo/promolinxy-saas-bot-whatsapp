// =====================================================
// WHATSAPP STATUS API
// =====================================================

import { NextResponse } from "next/server"
import { queryOne, update } from "@/lib/db"
import type { WhatsAppSession, ApiResponse } from "@/lib/types"

import { DEFAULT_TENANT_ID } from "@/lib/constants/config"

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
  // In production, trigger the external WhatsApp Engine service if configured.
  // Try env var first, then default to localhost where the engine typically listens in dev.
  const engineUrl = process.env.WHATSAPP_ENGINE_URL || "http://localhost:3001"

    if (engineUrl) {
      try {
        const resp = await fetch(`${engineUrl.replace(/\/$/, "")}/api/whatsapp/connect/${DEFAULT_TENANT_ID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (!resp.ok) {
          // If backend failed, log and fall back to demo behavior
          console.error("WhatsApp engine responded with error status", resp.status)
        } else {
          const body = await resp.json()
          return NextResponse.json({ success: true, message: body.message || "Conexão iniciada." })
        }
      } catch (err) {
        console.error("Error contacting WhatsApp engine:", err)
        // fallthrough to demo behavior
      }
    }

    // Fallback/demo behavior when engine URL is not set or call failed.
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
