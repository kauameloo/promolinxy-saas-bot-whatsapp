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
    const targetUrl = `${engineUrl.replace(/\/$/, "")}/api/whatsapp/connect/${DEFAULT_TENANT_ID}`
    
    console.log(`[WhatsApp Status API] WHATSAPP_ENGINE_URL configured as: ${engineUrl}`)
    console.log(`[WhatsApp Status API] Attempting to connect to: ${targetUrl}`)

    if (engineUrl) {
      try {
        const resp = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        console.log(`[WhatsApp Status API] Backend response status: ${resp.status}`)

        if (!resp.ok) {
          // If backend failed, log and fall back to demo behavior
          console.error(`[WhatsApp Status API] WhatsApp engine responded with error status: ${resp.status}`)
          const errorBody = await resp.text()
          console.error(`[WhatsApp Status API] Error body: ${errorBody}`)
        } else {
          const body = await resp.json()
          console.log(`[WhatsApp Status API] Connection successful:`, body)
          return NextResponse.json({ success: true, message: body.message || "Conexão iniciada." })
        }
      } catch (err) {
        console.error(`[WhatsApp Status API] Error contacting WhatsApp engine at ${targetUrl}:`, err)
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
