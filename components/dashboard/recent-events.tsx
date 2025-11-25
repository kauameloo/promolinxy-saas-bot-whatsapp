// =====================================================
// RECENT EVENTS - Lista de eventos recentes
// =====================================================

import { cn } from "@/lib/utils"
import { EVENT_LABELS, EVENT_COLORS } from "@/lib/constants/default-flows"
import type { WebhookEvent, CaktoEventType } from "@/lib/types"
import { formatDate } from "@/lib/utils/message-parser"
import { CheckCircle, XCircle, Clock } from "lucide-react"

interface RecentEventsProps {
  events: WebhookEvent[]
}

export function RecentEvents({ events }: RecentEventsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Eventos Recentes</h3>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento recebido ainda</p>
      ) : (
        <div className="space-y-3">
          {events.slice(0, 5).map((event) => (
            <div key={event.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    EVENT_COLORS[event.event_type as CaktoEventType] || "bg-gray-500",
                  )}
                />
                <div>
                  <p className="text-sm font-medium">
                    {EVENT_LABELS[event.event_type as CaktoEventType] || event.event_type}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                </div>
              </div>
              <div>
                {event.processed ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : event.error_message ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
