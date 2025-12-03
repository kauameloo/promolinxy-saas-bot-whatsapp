// =====================================================
// AUTH ME - Retorna usuário autenticado
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { verifyJWT } from "@/lib/utils/crypto"
import type { User, JWTPayload, ApiResponse } from "@/lib/types"

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production"

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Omit<User, "password_hash">>>> {
  try {
    // Extrai token do header
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Token não fornecido" }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verifica token
    const { valid, payload, error } = verifyJWT<JWTPayload>(token, JWT_SECRET)
    if (!valid || !payload) {
      return NextResponse.json({ success: false, error: error || "Token inválido" }, { status: 401 })
    }

    // Busca usuário atualizado
    const user = await queryOne<User>(`SELECT * FROM users WHERE id = $1 AND is_active = true`, [payload.userId])

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 })
    }

    // Remove password_hash do retorno
    const { password_hash: _, ...userWithoutPassword } = user

    return NextResponse.json({
      success: true,
      data: userWithoutPassword as Omit<User, "password_hash">,
    })
  } catch (error) {
    console.error("Auth me error:", error)
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor"
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? String(error) : undefined
    }, { status: 500 })
  }
}
