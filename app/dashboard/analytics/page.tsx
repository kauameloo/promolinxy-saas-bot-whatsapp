// =====================================================
// ANALYTICS PAGE - Métricas e estatísticas detalhadas
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { useApi } from "@/lib/hooks/use-api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DashboardStats, ChartDataPoint } from "@/lib/types"
import { EVENT_LABELS, EVENT_COLORS } from "@/lib/constants/default-flows"
import { Loader2, TrendingUp, TrendingDown, Activity, MessageSquare, Users, ShoppingCart, DollarSign } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
}: {
  title: string
  value: string | number
  description: string
  icon: React.ElementType
  trend?: "up" | "down" | "neutral"
  trendValue?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
          {trendValue && <span className={trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : ""}>{trendValue}</span>}
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading } = useApi<DashboardStats>("/api/dashboard/stats")
  const { data: chartData7 } = useApi<ChartDataPoint[]>("/api/dashboard/chart?days=7")
  const { data: chartData30 } = useApi<ChartDataPoint[]>("/api/dashboard/chart?days=30")
  const { data: eventsByType } = useApi<Record<string, number>>("/api/dashboard/events-by-type")

  // Prepare pie chart data
  const pieData = eventsByType
    ? Object.entries(eventsByType).map(([key, value]) => ({
        name: EVENT_LABELS[key as keyof typeof EVENT_LABELS] || key,
        value,
        color: EVENT_COLORS[key as keyof typeof EVENT_COLORS]?.replace("bg-", "") || "gray-500",
      }))
    : []

  const COLORS = ["#f59e0b", "#22c55e", "#a855f7", "#8b5cf6", "#ef4444", "#10b981", "#f43f5e"]

  if (statsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header title="Analytics" description="Métricas e estatísticas detalhadas do seu sistema" />

      <div className="flex-1 space-y-6 p-6">
        {/* Main Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Mensagens"
            value={stats?.totalMessages || 0}
            description="hoje"
            icon={MessageSquare}
            trend="up"
            trendValue="+12%"
          />
          <StatCard
            title="Taxa de Entrega"
            value={`${stats?.totalMessages ? Math.round((stats.messagesDelivered / stats.totalMessages) * 100) : 0}%`}
            description="de sucesso"
            icon={Activity}
            trend="up"
            trendValue="+5%"
          />
          <StatCard
            title="Clientes Ativos"
            value={stats?.totalCustomers || 0}
            description="cadastrados"
            icon={Users}
          />
          <StatCard
            title="Receita Total"
            value={formatCurrency(stats?.revenue || 0)}
            description="últimos 30 dias"
            icon={DollarSign}
            trend="up"
            trendValue="+18%"
          />
        </div>

        {/* Charts */}
        <Tabs defaultValue="7days" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Desempenho de Mensagens</h2>
            <TabsList>
              <TabsTrigger value="7days">7 dias</TabsTrigger>
              <TabsTrigger value="30days">30 dias</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="7days" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Line Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Mensagens ao Longo do Tempo</CardTitle>
                  <CardDescription>Últimos 7 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData7 || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} name="Enviadas" />
                      <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} name="Entregues" />
                      <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} name="Falhas" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Comparativo Diário</CardTitle>
                  <CardDescription>Entregues vs Falhas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData7 || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="delivered" fill="#22c55e" radius={[4, 4, 0, 0]} name="Entregues" />
                      <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Falhas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="30days" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Line Chart 30 days */}
              <Card>
                <CardHeader>
                  <CardTitle>Mensagens ao Longo do Tempo</CardTitle>
                  <CardDescription>Últimos 30 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData30 || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} name="Enviadas" />
                      <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} name="Entregues" />
                      <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} name="Falhas" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar Chart 30 days */}
              <Card>
                <CardHeader>
                  <CardTitle>Comparativo Diário</CardTitle>
                  <CardDescription>Entregues vs Falhas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData30 || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="delivered" fill="#22c55e" radius={[4, 4, 0, 0]} name="Entregues" />
                      <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Falhas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Events and Orders */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Events by Type */}
          <Card>
            <CardHeader>
              <CardTitle>Eventos por Tipo</CardTitle>
              <CardDescription>Distribuição dos webhooks recebidos</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Nenhum evento recebido ainda
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Conversão</CardTitle>
              <CardDescription>Desempenho das vendas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total de Pedidos</span>
                  <span className="font-semibold">{stats?.totalOrders || 0}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full w-full rounded-full bg-blue-500" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Taxa de Conversão</span>
                  <span className="font-semibold">{stats?.conversionRate || 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${stats?.conversionRate || 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mensagens Entregues</span>
                  <span className="font-semibold">
                    {stats?.totalMessages
                      ? `${Math.round((stats.messagesDelivered / stats.totalMessages) * 100)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${stats?.totalMessages ? (stats.messagesDelivered / stats.totalMessages) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Taxa de Falha</span>
                  <span className="font-semibold text-red-500">
                    {stats?.totalMessages
                      ? `${Math.round((stats.messagesFailed / stats.totalMessages) * 100)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width: `${stats?.totalMessages ? (stats.messagesFailed / stats.totalMessages) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
