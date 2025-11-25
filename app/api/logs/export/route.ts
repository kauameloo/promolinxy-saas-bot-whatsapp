// =====================================================
// LOGS EXPORT - Exporta logs em CSV
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined

    let queryText = `
      SELECT ml.phone, ml.message_content, ml.status, ml.created_at, c.name as customer_name
      FROM message_logs ml
      LEFT JOIN customers c ON ml.customer_id = c.id
      WHERE ml.tenant_id = $1
    `
    const params: unknown[] = [DEFAULT_TENANT_ID]

    if (status) {
      queryText += ` AND ml.status = $${params.length + 1}`
      params.push(status)
    }

    queryText += ` ORDER BY ml.created_at DESC LIMIT 10000`

    const results = await sql<any[]>(queryText, params)

    // Build CSV
    const header = ["phone", "customer_name", "status", "created_at", "message_content"]
    const rows = results.map((r: any) => [
      r.phone,
      r.customer_name || "",
      r.status,
      new Date(r.created_at).toISOString(),
      (r.message_content || "").replace(/\r|\n/g, " "),
    ])

    const csv = [
      header.join(","),
      ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=message_logs_${new Date().toISOString().slice(0,10)}.csv`,
      },
    })
  } catch (error) {
    console.error("Export logs error:", error)
    return NextResponse.json({ success: false, error: "Erro ao exportar logs" }, { status: 500 })
  }
}
