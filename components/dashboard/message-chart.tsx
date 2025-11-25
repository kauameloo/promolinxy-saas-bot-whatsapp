// =====================================================
// MESSAGE CHART - Gráfico de mensagens
// =====================================================

"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ChartDataPoint } from "@/lib/types"

interface MessageChartProps {
  data: ChartDataPoint[]
}

export function MessageChart({ data }: MessageChartProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-6 text-lg font-semibold">Mensagens Enviadas</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Area
              type="monotone"
              dataKey="sent"
              name="Enviadas"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorSent)"
            />
            <Area
              type="monotone"
              dataKey="delivered"
              name="Entregues"
              stroke="hsl(142, 76%, 36%)"
              fillOpacity={1}
              fill="url(#colorDelivered)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
