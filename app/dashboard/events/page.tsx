// =====================================================
// EVENTS PAGE - Eventos de webhook
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { useApi } from "@/lib/hooks/use-api"
import type { WebhookEvent, CaktoEventType } from "@/lib/types"
import { EVENT_LABELS, EVENT_COLORS } from "@/lib/constants/default-flows"
import { formatDate } from "@/lib/utils/message-parser"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Webhook, CheckCircle, XCircle, Clock } from "lucide-react"

export default function EventsPage() {
  const { data: events, isLoading } = useApi<WebhookEvent[]>("/api/events?limit=100")

  return (
    <div className="flex flex-col">
      <Header title="Eventos de Webhook" description="Eventos recebidos da Cakto" />

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12">
            <Webhook className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum evento ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Os eventos aparecerão aqui quando webhooks forem recebidos
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            EVENT_COLORS[event.event_type as CaktoEventType] || "bg-gray-500",
                          )}
                        />
                        <span className="font-medium">
                          {EVENT_LABELS[event.event_type as CaktoEventType] || event.event_type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{event.source}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {event.processed ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-500">Processado</span>
                          </>
                        ) : event.error_message ? (
                          <>
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-sm text-destructive">Erro</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-amber-500">Pendente</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(event.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
