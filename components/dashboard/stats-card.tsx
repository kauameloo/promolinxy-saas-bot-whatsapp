// =====================================================
// STATS CARD - Card de estatísticas
// =====================================================

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatsCard({ title, value, description, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold">{value}</p>
        {(description || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {trend && (
              <span className={cn("text-sm font-medium", trend.isPositive ? "text-green-500" : "text-red-500")}>
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
            )}
            {description && <span className="text-sm text-muted-foreground">{description}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
