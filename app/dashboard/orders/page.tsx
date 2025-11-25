// =====================================================
// ORDERS PAGE - Lista de pedidos
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { useApi } from "@/lib/hooks/use-api"
import type { Order } from "@/lib/types"
import { formatDate, formatCurrency } from "@/lib/utils/message-parser"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, ShoppingCart } from "lucide-react"

const statusConfig = {
  pending: { label: "Pendente", variant: "secondary" as const },
  paid: { label: "Pago", variant: "default" as const },
  refused: { label: "Recusado", variant: "destructive" as const },
  refunded: { label: "Reembolsado", variant: "outline" as const },
  cancelled: { label: "Cancelado", variant: "secondary" as const },
}

export default function OrdersPage() {
  const { data, isLoading } = useApi<{ data: Order[]; pagination: { total: number } }>("/api/orders?limit=50")

  const orders = Array.isArray(data) ? data : data?.data || []

  return (
    <div className="flex flex-col">
      <Header title="Pedidos" description="Acompanhe todos os pedidos" />

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum pedido ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">Os pedidos aparecerão aqui quando receberem webhooks</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const status = statusConfig[order.status] || statusConfig.pending
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.product_name || "Produto"}</TableCell>
                      <TableCell>
                        {typeof order.customer === "object" && order.customer?.name ? order.customer.name : "-"}
                      </TableCell>
                      <TableCell>{order.amount ? formatCurrency(order.amount) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
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
