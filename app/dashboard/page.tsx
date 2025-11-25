// =====================================================
// DASHBOARD PAGE - Página principal do dashboard
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { StatsCard } from "@/components/dashboard/stats-card"
import { MessageChart } from "@/components/dashboard/message-chart"
import { WhatsAppStatus } from "@/components/dashboard/whatsapp-status"
import { RecentEvents } from "@/components/dashboard/recent-events"
import { useApi } from "@/lib/hooks/use-api"
import type { DashboardStats, ChartDataPoint, WebhookEvent } from "@/lib/types"
import { MessageSquare, CheckCircle, XCircle, Users, ShoppingCart, TrendingUp, DollarSign } from "lucide-react"

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useApi<DashboardStats>("/api/dashboard/stats")
  const { data: chartData } = useApi<ChartDataPoint[]>("/api/dashboard/chart?days=7")
  const { data: events } = useApi<WebhookEvent[]>("/api/events?limit=5")

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" description="Visão geral do seu sistema de automação" />

      <div className="flex-1 space-y-6 p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Mensagens Hoje"
            value={statsLoading ? "..." : stats?.totalMessages || 0}
            icon={MessageSquare}
            description="enviadas"
          />
          <StatsCard
            title="Entregues"
            value={statsLoading ? "..." : stats?.messagesDelivered || 0}
            icon={CheckCircle}
            description="com sucesso"
          />
          <StatsCard
            title="Falhas"
            value={statsLoading ? "..." : stats?.messagesFailed || 0}
            icon={XCircle}
            description="erros"
          />
          <StatsCard
            title="Clientes"
            value={statsLoading ? "..." : stats?.totalCustomers || 0}
            icon={Users}
            description="cadastrados"
          />
        </div>

        {/* Second Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Pedidos"
            value={statsLoading ? "..." : stats?.totalOrders || 0}
            icon={ShoppingCart}
            description="últimos 30 dias"
          />
          <StatsCard
            title="Taxa de Conversão"
            value={statsLoading ? "..." : `${stats?.conversionRate || 0}%`}
            icon={TrendingUp}
            description="aprovados"
          />
          <StatsCard
            title="Receita"
            value={statsLoading ? "..." : formatCurrency(stats?.revenue || 0)}
            icon={DollarSign}
            description="últimos 30 dias"
          />
          <WhatsAppStatus status={stats?.whatsappStatus || "disconnected"} />
        </div>

        {/* Charts and Events */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MessageChart data={chartData || []} />
          </div>
          <RecentEvents events={events || []} />
        </div>
      </div>
    </div>
  )
}
