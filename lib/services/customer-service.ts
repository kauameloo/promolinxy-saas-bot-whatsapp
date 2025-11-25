// =====================================================
// CUSTOMER SERVICE - Gerenciamento de clientes
// =====================================================

import { query, queryOne, insert, update } from "@/lib/db"
import type { Customer, CaktoWebhookPayload } from "@/lib/types"

export class CustomerService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Busca ou cria um cliente baseado no webhook da Cakto
   */
  async findOrCreateFromWebhook(payload: CaktoWebhookPayload): Promise<Customer> {
    const customerData = payload.customer
    if (!customerData?.phone) {
      throw new Error("Customer phone is required")
    }

    // Normaliza o telefone
    const phone = customerData.phone.replace(/\D/g, "")

    // Tenta encontrar pelo telefone
    let customer = await queryOne<Customer>(`SELECT * FROM customers WHERE tenant_id = $1 AND phone = $2`, [
      this.tenantId,
      phone,
    ])

    if (customer) {
      // Atualiza dados se necessário
      if (customerData.name !== customer.name || customerData.email !== customer.email) {
        customer = await update<Customer>("customers", customer.id, {
          name: customerData.name || customer.name,
          email: customerData.email || customer.email,
          document: customerData.document || customer.document,
        })
      }
      return customer!
    }

    // Cria novo cliente
    customer = await insert<Customer>("customers", {
      tenant_id: this.tenantId,
      name: customerData.name || "Cliente",
      email: customerData.email,
      phone,
      document: customerData.document,
      metadata: {},
      tags: JSON.stringify([]),
    })

    return customer
  }

  /**
   * Lista clientes com paginação
   */
  async list(page = 1, limit = 20): Promise<{ customers: Customer[]; total: number }> {
    const offset = (page - 1) * limit

    const customers = await query<Customer>(
      `SELECT * FROM customers 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [this.tenantId, limit, offset],
    )

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM customers WHERE tenant_id = $1`,
      [this.tenantId],
    )

    return {
      customers,
      total: Number.parseInt(countResult?.count || "0"),
    }
  }

  /**
   * Busca cliente por ID
   */
  async findById(id: string): Promise<Customer | null> {
    return queryOne<Customer>(`SELECT * FROM customers WHERE id = $1 AND tenant_id = $2`, [id, this.tenantId])
  }

  /**
   * Busca cliente por telefone
   */
  async findByPhone(phone: string): Promise<Customer | null> {
    const normalizedPhone = phone.replace(/\D/g, "")
    return queryOne<Customer>(`SELECT * FROM customers WHERE phone = $1 AND tenant_id = $2`, [
      normalizedPhone,
      this.tenantId,
    ])
  }

  /**
   * Atualiza tags do cliente
   */
  async updateTags(id: string, tags: string[]): Promise<Customer | null> {
    return update<Customer>("customers", id, {
      tags: JSON.stringify(tags),
    })
  }
}
