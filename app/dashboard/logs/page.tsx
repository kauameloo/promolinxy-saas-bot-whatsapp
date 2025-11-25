// =====================================================
// LOGS PAGE - Logs de mensagens
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { useApi } from "@/lib/hooks/use-api"
import type { MessageLog } from "@/lib/types"
import { formatDate } from "@/lib/utils/message-parser"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, FileText } from "lucide-react"

const statusConfig = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-500" },
  sent: { label: "Enviada", className: "bg-blue-500/10 text-blue-500" },
  delivered: { label: "Entregue", className: "bg-green-500/10 text-green-500" },
  read: { label: "Lida", className: "bg-emerald-500/10 text-emerald-500" },
  failed: { label: "Falhou", className: "bg-red-500/10 text-red-500" },
}

export default function LogsPage() {
  const { data, isLoading } = useApi<{ data: MessageLog[]; pagination: { total: number } }>("/api/logs?limit=100")

  const logs = Array.isArray(data) ? data : data?.data || []

  return (
    <div className="flex flex-col">
      <Header title="Logs de Mensagens" description="Histórico de mensagens enviadas" />

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum log ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Os logs aparecerão aqui quando mensagens forem enviadas
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="max-w-md">Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const status = statusConfig[log.status] || statusConfig.pending
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">{log.phone}</TableCell>
                      <TableCell className="max-w-md truncate">{log.message_content.substring(0, 100)}...</TableCell>
                      <TableCell>
                        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", status.className)}>
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(log.created_at)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
