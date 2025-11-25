// =====================================================
// SETTINGS API - Gerenciamento de configurações
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import type { ApiResponse } from "@/lib/types"
import { DEFAULT_TENANT_ID } from "@/lib/constants/config"
import { z } from "zod"

interface Setting {
  id: string
  tenant_id: string
  key: string
  value: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

const UpdateSettingsSchema = z.object({
  webhook_secret: z.string().optional(),
  notifications: z
    .object({
      errors_enabled: z.boolean().optional(),
      disconnect_enabled: z.boolean().optional(),
      daily_report_enabled: z.boolean().optional(),
    })
    .optional(),
})

// GET - Obtém todas as configurações
export async function GET(): Promise<NextResponse<ApiResponse<Record<string, unknown>>>> {
  try {
    const settings = await query<Setting>(
      `SELECT * FROM settings WHERE tenant_id = $1`,
      [DEFAULT_TENANT_ID]
    )

    const result: Record<string, unknown> = {}
    for (const setting of settings) {
      result[setting.key] = setting.value
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json({ success: false, error: "Erro ao buscar configurações" }, { status: 500 })
  }
}

// PUT - Atualiza configurações
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json()

    const validation = UpdateSettingsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const updates = validation.data

    // Atualiza webhook_secret
    if (updates.webhook_secret !== undefined) {
      await upsertSetting("webhook_secret", { value: updates.webhook_secret })
    }

    // Atualiza notificações
    if (updates.notifications !== undefined) {
      await upsertSetting("notifications", updates.notifications)
    }

    return NextResponse.json({
      success: true,
      message: "Configurações atualizadas com sucesso",
    })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json({ success: false, error: "Erro ao atualizar configurações" }, { status: 500 })
  }
}

async function upsertSetting(key: string, value: Record<string, unknown>): Promise<void> {
  const existing = await queryOne<Setting>(
    `SELECT id FROM settings WHERE tenant_id = $1 AND key = $2`,
    [DEFAULT_TENANT_ID, key]
  )

  if (existing) {
    await query(
      `UPDATE settings SET value = $1, updated_at = NOW() WHERE tenant_id = $2 AND key = $3`,
      [JSON.stringify(value), DEFAULT_TENANT_ID, key]
    )
  } else {
    await query(
      `INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3)`,
      [DEFAULT_TENANT_ID, key, JSON.stringify(value)]
    )
  }
}
