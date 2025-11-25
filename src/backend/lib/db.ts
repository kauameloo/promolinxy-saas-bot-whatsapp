// =====================================================
// DATABASE - PostgreSQL Connection for Backend
// =====================================================

import { Pool, PoolClient, QueryResult } from "pg"

// Create pool with connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Log pool errors
pool.on("error", (err: Error) => {
  console.error("[Database] Unexpected error on idle client:", err)
})

// Export pool for direct use
export { pool as dbPool }

// Helper for typed queries
export async function query<T>(queryText: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result: QueryResult = await client.query(queryText, params)
    return result.rows as T[]
  } catch (error) {
    console.error("[Database] Query error:", error)
    throw error
  } finally {
    client.release()
  }
}

// Helper for single result query
export async function queryOne<T>(queryText: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T>(queryText, params)
  return results[0] || null
}

// Helper for insert with returning
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

// Helper for update with returning
export async function update<T>(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<T | null> {
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

// Helper for delete
export async function remove(table: string, id: string): Promise<boolean> {
  await query(`DELETE FROM ${table} WHERE id = $1`, [id])
  return true
}

// Close pool (for graceful shutdown)
export async function closePool(): Promise<void> {
  await pool.end()
  console.log("[Database] Connection pool closed")
}
