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
    console.log(`Looking up customer by phone: ${phone}`)

    // Tenta encontrar pelo telefone
    let customer = await queryOne<Customer>(`SELECT * FROM customers WHERE tenant_id = $1 AND phone = $2`, [
      this.tenantId,
      phone,
    ])

    if (customer) {
      console.log(`Customer found: ${customer.name} (${customer.id})`)
      
      // Atualiza dados se necessário (mantém dados mais completos)
      // Só atualiza se o novo valor é válido (não vazio) E diferente do atual
      const shouldUpdateName = customerData.name && customerData.name.trim() !== "" && customerData.name !== customer.name
      const shouldUpdateEmail = customerData.email && customerData.email.trim() !== "" && customerData.email !== customer.email
      const shouldUpdateDocument = customerData.document && customerData.document.trim() !== "" && customerData.document !== customer.document

      if (shouldUpdateName || shouldUpdateEmail || shouldUpdateDocument) {
        const updateData: Record<string, string> = {}
        if (shouldUpdateName) updateData.name = customerData.name
        if (shouldUpdateEmail) updateData.email = customerData.email
        if (shouldUpdateDocument) updateData.document = customerData.document
        
        console.log("Updating customer with new data:", updateData)
        customer = await update<Customer>("customers", customer.id, updateData)
        console.log("✓ Customer updated successfully")
      }
      return customer!
    }

    // Cria novo cliente
    const newCustomerData = {
      tenant_id: this.tenantId,
      name: customerData.name || "Cliente",
      email: customerData.email,
      phone,
      document: customerData.document,
      metadata: {},
      tags: JSON.stringify([]),
    }
    
    console.log("Creating new customer:", newCustomerData)
    customer = await insert<Customer>("customers", newCustomerData)
    console.log(`✓ New customer created: ${customer.name} (${customer.id})`)

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
