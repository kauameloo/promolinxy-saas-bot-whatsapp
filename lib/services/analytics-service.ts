// =====================================================
// ANALYTICS SERVICE - Métricas e estatísticas
// =====================================================

import { query, queryOne, sql } from "@/lib/db"
import type { DashboardStats, ChartDataPoint } from "@/lib/types"

export class AnalyticsService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Busca estatísticas do dashboard
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // Total de mensagens enviadas hoje
    const messagesResult = await queryOne<{ total: string; delivered: string; failed: string }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')) as delivered,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM message_logs 
       WHERE tenant_id = $1 
       AND created_at >= CURRENT_DATE`,
      [this.tenantId],
    )

    // Total de clientes
    const customersResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM customers WHERE tenant_id = $1`,
      [this.tenantId],
    )

    // Total de pedidos e conversões
    const ordersResult = await queryOne<{ total: string; paid: string; revenue: string }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'paid') as paid,
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as revenue
       FROM orders 
       WHERE tenant_id = $1 
       AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
      [this.tenantId],
    )

    // Status do WhatsApp
    const whatsappResult = await queryOne<{ status: string }>(
      `SELECT status FROM whatsapp_sessions WHERE tenant_id = $1 LIMIT 1`,
      [this.tenantId],
    )

    const totalOrders = Number.parseInt(ordersResult?.total || "0")
    const paidOrders = Number.parseInt(ordersResult?.paid || "0")
    const conversionRate = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0

    return {
      totalMessages: Number.parseInt(messagesResult?.total || "0"),
      messagesDelivered: Number.parseInt(messagesResult?.delivered || "0"),
      messagesFailed: Number.parseInt(messagesResult?.failed || "0"),
      totalCustomers: Number.parseInt(customersResult?.count || "0"),
      totalOrders,
      conversionRate: Math.round(conversionRate * 100) / 100,
      revenue: Number.parseFloat(ordersResult?.revenue || "0"),
      whatsappStatus: (whatsappResult?.status as DashboardStats["whatsappStatus"]) || "disconnected",
    }
  }

  /**
   * Busca dados para gráfico de mensagens (últimos N dias)
   */
  async getMessageChartData(days = 7): Promise<ChartDataPoint[]> {
    const results = await query<{
      date: string
      sent: string
      delivered: string
      read: string
      failed: string
    }>(
      `WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days - 1} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as date
      )
      SELECT 
        d.date::text,
        COALESCE(COUNT(ml.id) FILTER (WHERE ml.status IN ('sent', 'delivered', 'read')), 0)::text as sent,
        COALESCE(COUNT(ml.id) FILTER (WHERE ml.status IN ('delivered', 'read')), 0)::text as delivered,
        COALESCE(COUNT(ml.id) FILTER (WHERE ml.status = 'read'), 0)::text as read,
        COALESCE(COUNT(ml.id) FILTER (WHERE ml.status = 'failed'), 0)::text as failed
      FROM dates d
      LEFT JOIN message_logs ml ON DATE(ml.created_at) = d.date AND ml.tenant_id = $1
      GROUP BY d.date
      ORDER BY d.date`,
      [this.tenantId],
    )

    return results.map((r) => ({
      date: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      sent: Number.parseInt(r.sent),
      delivered: Number.parseInt(r.delivered),
      read: Number.parseInt(r.read),
      failed: Number.parseInt(r.failed),
    }))
  }

  /**
   * Busca eventos por tipo (últimos N dias)
   */
  async getEventsByType(days = 30): Promise<Record<string, number>> {
    const results = await query<{ event_type: string; count: string }>(
      `SELECT event_type, COUNT(*) as count
       FROM webhook_events
       WHERE tenant_id = $1
       AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY event_type`,
      [this.tenantId],
    )

    const counts: Record<string, number> = {}
    results.forEach((r) => {
      counts[r.event_type] = Number.parseInt(r.count)
    })

    return counts
  }

  /**
   * Atualiza métricas diárias
   */
  async updateDailyMetrics(): Promise<void> {
    const today = new Date().toISOString().split("T")[0]

    // Calcula métricas do dia
    const metrics = await queryOne<{
      sent: string
      delivered: string
      read: string
      failed: string
      webhooks: string
      conversions: string
      revenue: string
    }>(
      `SELECT 
        (SELECT COUNT(*) FROM message_logs WHERE tenant_id = $1 AND DATE(created_at) = $2 AND status IN ('sent', 'delivered', 'read'))::text as sent,
        (SELECT COUNT(*) FROM message_logs WHERE tenant_id = $1 AND DATE(created_at) = $2 AND status IN ('delivered', 'read'))::text as delivered,
        (SELECT COUNT(*) FROM message_logs WHERE tenant_id = $1 AND DATE(created_at) = $2 AND status = 'read')::text as read,
        (SELECT COUNT(*) FROM message_logs WHERE tenant_id = $1 AND DATE(created_at) = $2 AND status = 'failed')::text as failed,
        (SELECT COUNT(*) FROM webhook_events WHERE tenant_id = $1 AND DATE(created_at) = $2)::text as webhooks,
        (SELECT COUNT(*) FROM orders WHERE tenant_id = $1 AND DATE(created_at) = $2 AND status = 'paid')::text as conversions,
        (SELECT COALESCE(SUM(amount), 0) FROM orders WHERE tenant_id = $1 AND DATE(created_at) = $2 AND status = 'paid')::text as revenue`,
      [this.tenantId, today],
    )

    // Upsert na tabela de métricas
    await sql`
      INSERT INTO analytics_daily (tenant_id, date, messages_sent, messages_delivered, messages_read, messages_failed, webhooks_received, conversions, revenue)
      VALUES (${this.tenantId}, ${today}, ${Number.parseInt(metrics?.sent || "0")}, ${Number.parseInt(metrics?.delivered || "0")}, ${Number.parseInt(metrics?.read || "0")}, ${Number.parseInt(metrics?.failed || "0")}, ${Number.parseInt(metrics?.webhooks || "0")}, ${Number.parseInt(metrics?.conversions || "0")}, ${Number.parseFloat(metrics?.revenue || "0")})
      ON CONFLICT (tenant_id, date) 
      DO UPDATE SET 
        messages_sent = EXCLUDED.messages_sent,
        messages_delivered = EXCLUDED.messages_delivered,
        messages_read = EXCLUDED.messages_read,
        messages_failed = EXCLUDED.messages_failed,
        webhooks_received = EXCLUDED.webhooks_received,
        conversions = EXCLUDED.conversions,
        revenue = EXCLUDED.revenue
    `
  }
}
