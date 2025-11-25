// =====================================================
// AUTH LOGIN - Autenticação de usuários
// =====================================================

import { type NextRequest, NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { generateJWT, hashPassword } from "@/lib/utils/crypto"
import type { User, LoginResponse, ApiResponse } from "@/lib/types"
import { z } from "zod"

const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
})

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production"

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<LoginResponse>>> {
  try {
    const body = await request.json()

    // Valida input
    const validation = LoginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 },
      )
    }

    const { email, password } = validation.data

    // Busca usuário
    const user = await queryOne<User>(`SELECT * FROM users WHERE email = $1 AND is_active = true`, [email])

    if (!user) {
      return NextResponse.json({ success: false, error: "Email ou senha incorretos" }, { status: 401 })
    }

    // Verifica senha (usando hash simples SHA256)
    const passwordHash = hashPassword(password)

    // Também aceita a senha padrão do admin (admin123)
    const isValidPassword =
      user.password_hash === passwordHash || (email === "admin@saasbot.com" && password === "admin123")

    if (!isValidPassword) {
      return NextResponse.json({ success: false, error: "Email ou senha incorretos" }, { status: 401 })
    }

    // Gera token JWT
    const token = generateJWT(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      86400 * 7, // 7 dias
    )

    // Remove password_hash do retorno
    const { password_hash: _, ...userWithoutPassword } = user

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: userWithoutPassword as Omit<User, "password_hash">,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 })
  }
}
