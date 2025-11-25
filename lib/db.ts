// =====================================================
// DATABASE - Conexão com Neon PostgreSQL
// =====================================================

import { neon } from "@neondatabase/serverless"

// Singleton para conexão do banco
const sql = neon(process.env.DATABASE_URL!)

export { sql }

// Helper para queries tipadas
export async function query<T>(queryText: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await sql(queryText, params)
    return result as T[]
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

// Helper para query única
export async function queryOne<T>(queryText: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T>(queryText, params)
  return results[0] || null
}

// Helper para insert retornando o registro
export async function insert<T>(table: string, data: Record<string, unknown>): Promise<T> {
  const keys = Object.keys(data)
  const values = Object.values(data)
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ")
  const columns = keys.join(", ")

  const queryText = `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    RETURNING *
  `

  const result = await query<T>(queryText, values)
  return result[0]
}

// Helper para update
export async function update<T>(table: string, id: string, data: Record<string, unknown>): Promise<T | null> {
  const keys = Object.keys(data)
  const values = Object.values(data)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ")

  const queryText = `
    UPDATE ${table}
    SET ${setClause}
    WHERE id = $${keys.length + 1}
    RETURNING *
  `

  const result = await query<T>(queryText, [...values, id])
  return result[0] || null
}

// Helper para delete
export async function remove(table: string, id: string): Promise<boolean> {
  const queryText = `DELETE FROM ${table} WHERE id = $1`
  await sql(queryText, [id])
  return true
}
