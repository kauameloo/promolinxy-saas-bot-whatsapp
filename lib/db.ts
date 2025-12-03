// =====================================================
// DATABASE - Conexão com Neon PostgreSQL
// =====================================================

import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

// Singleton para conexão do banco (lazy initialization)
let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set")
    }
    _sql = neon(connectionString)
  }
  return _sql
}

// Export the getter function for direct SQL usage (tagged template literals)
export { getSql as sql }

// Helper for typed queries with parameterized statements
export async function query<T>(queryText: string, params?: unknown[]): Promise<T[]> {
  try {
    const sqlInstance = getSql()
    // Neon serverless driver expects direct call with query and params
    const result = await sqlInstance(queryText, params || [])
    return result as T[]
  } catch (error) {
    console.error("Database query error:", error)
    console.error("Query:", queryText)
    // Only log params in development to avoid exposing sensitive data
    if (process.env.NODE_ENV === "development") {
      console.error("Params:", params)
    }
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
  const sqlInstance = getSql()
  await sqlInstance(queryText, [id])
  return true
}
