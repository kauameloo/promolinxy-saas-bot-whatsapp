// =====================================================
// FLOW SERVICE - Gerenciamento de fluxos de mensagens
// =====================================================

import { query, queryOne, insert, update, remove } from "@/lib/db"
import type { MessageFlow, FlowMessage, CaktoEventType } from "@/lib/types"

export class FlowService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Cria um novo fluxo
   */
  async createFlow(data: {
    name: string
    event_type: CaktoEventType
    description?: string
    is_active?: boolean
  }): Promise<MessageFlow> {
    return insert<MessageFlow>("message_flows", {
      tenant_id: this.tenantId,
      name: data.name,
      event_type: data.event_type,
      description: data.description,
      is_active: data.is_active ?? true,
      settings: JSON.stringify({}),
    })
  }

  /**
   * Atualiza um fluxo
   */
  async updateFlow(
    id: string,
    data: Partial<Pick<MessageFlow, "name" | "description" | "is_active" | "settings">>,
  ): Promise<MessageFlow | null> {
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.is_active !== undefined) updateData.is_active = data.is_active
    if (data.settings !== undefined) updateData.settings = JSON.stringify(data.settings)

    return update<MessageFlow>("message_flows", id, updateData)
  }

  /**
   * Busca fluxo por ID com mensagens
   */
  async findById(id: string): Promise<MessageFlow | null> {
    const flow = await queryOne<MessageFlow>(`SELECT * FROM message_flows WHERE id = $1 AND tenant_id = $2`, [
      id,
      this.tenantId,
    ])

    if (flow) {
      const messages = await this.getFlowMessages(id)
      flow.messages = messages
    }

    return flow
  }

  /**
   * Busca fluxos ativos por tipo de evento
   */
  async findActiveByEventType(eventType: CaktoEventType): Promise<MessageFlow[]> {
    const flows = await query<MessageFlow>(
      `SELECT * FROM message_flows 
       WHERE tenant_id = $1 AND event_type = $2 AND is_active = true`,
      [this.tenantId, eventType],
    )

    // Carrega mensagens de cada fluxo
    for (const flow of flows) {
      flow.messages = await this.getFlowMessages(flow.id)
    }

    return flows
  }

  /**
   * Lista todos os fluxos
   */
  async list(): Promise<MessageFlow[]> {
    const flows = await query<MessageFlow>(
      `SELECT * FROM message_flows WHERE tenant_id = $1 ORDER BY event_type, name`,
      [this.tenantId],
    )

    // Conta mensagens por fluxo
    for (const flow of flows) {
      const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM flow_messages WHERE flow_id = $1`,
        [flow.id],
      )
      flow.messages = new Array(Number.parseInt(countResult?.count || "0"))
    }

    return flows
  }

  /**
   * Remove um fluxo
   */
  async deleteFlow(id: string): Promise<boolean> {
    return remove("message_flows", id)
  }

  /**
   * Adiciona mensagem a um fluxo
   */
  async addMessage(
    flowId: string,
    data: {
      content: string
      delay_minutes: number
      message_order?: number
      media_url?: string
      media_type?: "image" | "video" | "audio" | "document"
    },
  ): Promise<FlowMessage> {
    // Calcula a próxima ordem se não fornecida
    let messageOrder = data.message_order
    if (messageOrder === undefined) {
      const maxOrder = await queryOne<{ max: number }>(
        `SELECT COALESCE(MAX(message_order), 0) as max FROM flow_messages WHERE flow_id = $1`,
        [flowId],
      )
      messageOrder = (maxOrder?.max || 0) + 1
    }

    return insert<FlowMessage>("flow_messages", {
      flow_id: flowId,
      message_order: messageOrder,
      content: data.content,
      delay_minutes: data.delay_minutes,
      media_url: data.media_url,
      media_type: data.media_type,
      is_active: true,
    })
  }

  /**
   * Atualiza uma mensagem
   */
  async updateMessage(
    id: string,
    data: Partial<
      Pick<FlowMessage, "content" | "delay_minutes" | "message_order" | "is_active" | "media_url" | "media_type">
    >,
  ): Promise<FlowMessage | null> {
    return update<FlowMessage>("flow_messages", id, data)
  }

  /**
   * Remove uma mensagem
   */
  async deleteMessage(id: string): Promise<boolean> {
    return remove("flow_messages", id)
  }

  /**
   * Busca mensagens de um fluxo ordenadas
   */
  async getFlowMessages(flowId: string): Promise<FlowMessage[]> {
    return query<FlowMessage>(
      `SELECT * FROM flow_messages 
       WHERE flow_id = $1 AND is_active = true 
       ORDER BY message_order`,
      [flowId],
    )
  }

  /**
   * Reordena mensagens de um fluxo
   */
  async reorderMessages(flowId: string, messageIds: string[]): Promise<void> {
    for (let i = 0; i < messageIds.length; i++) {
      await update("flow_messages", messageIds[i], { message_order: i + 1 })
    }
  }
}
