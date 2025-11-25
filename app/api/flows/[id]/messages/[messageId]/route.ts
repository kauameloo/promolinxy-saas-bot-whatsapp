// =====================================================
// MESSAGE CRUD - Editar e deletar mensagens individuais
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { ApiResponse, FlowMessage } from "@/lib/types"
import { z } from "zod"

const UpdateMessageSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório").optional(),
  delay_minutes: z.number().min(0, "Delay não pode ser negativo").optional(),
  message_order: z.number().optional(),
  media_url: z.string().url().optional().nullable(),
  media_type: z.enum(["image", "video", "audio", "document"]).optional().nullable(),
})

// PUT - Atualiza uma mensagem
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
): Promise<NextResponse<ApiResponse<FlowMessage>>> {
  try {
    const { id: flowId, messageId } = await params
    const body = await request.json()

    const validation = UpdateMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const updates = validation.data
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`)
      values.push(updates.content)
    }
    if (updates.delay_minutes !== undefined) {
      setClauses.push(`delay_minutes = $${paramIndex++}`)
      values.push(updates.delay_minutes)
    }
    if (updates.message_order !== undefined) {
      setClauses.push(`message_order = $${paramIndex++}`)
      values.push(updates.message_order)
    }
    if (updates.media_url !== undefined) {
      setClauses.push(`media_url = $${paramIndex++}`)
      values.push(updates.media_url)
    }
    if (updates.media_type !== undefined) {
      setClauses.push(`media_type = $${paramIndex++}`)
      values.push(updates.media_type)
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: "Nenhum campo para atualizar" }, { status: 400 })
    }

    setClauses.push("updated_at = NOW()")
    values.push(messageId, flowId)

    const result = await sql`
      UPDATE flow_messages 
      SET ${sql.unsafe(setClauses.join(", "))}
      WHERE id = $${paramIndex++} AND flow_id = $${paramIndex}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "Mensagem não encontrada" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result[0] as FlowMessage,
    })
  } catch (error) {
    console.error("Update message error:", error)
    return NextResponse.json({ success: false, error: "Erro ao atualizar mensagem" }, { status: 500 })
  }
}

// DELETE - Remove uma mensagem
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id: flowId, messageId } = await params

    const result = await sql`
      DELETE FROM flow_messages 
      WHERE id = ${messageId} AND flow_id = ${flowId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "Mensagem não encontrada" }, { status: 404 })
    }

    // Reordenar mensagens restantes
    await sql`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY message_order) as new_order
        FROM flow_messages
        WHERE flow_id = ${flowId}
      )
      UPDATE flow_messages fm
      SET message_order = o.new_order
      FROM ordered o
      WHERE fm.id = o.id
    `

    return NextResponse.json({
      success: true,
      data: null,
    })
  } catch (error) {
    console.error("Delete message error:", error)
    return NextResponse.json({ success: false, error: "Erro ao excluir mensagem" }, { status: 500 })
  }
}
