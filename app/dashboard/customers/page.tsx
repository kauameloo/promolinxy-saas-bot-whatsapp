// =====================================================
// CUSTOMERS PAGE - Lista de clientes
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { useApi } from "@/lib/hooks/use-api"
import type { Customer } from "@/lib/types"
import { formatDate } from "@/lib/utils/message-parser"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Users } from "lucide-react"

export default function CustomersPage() {
  const { data, isLoading } = useApi<{ data: Customer[]; pagination: { total: number } }>("/api/customers?limit=50")

  const customers = Array.isArray(data) ? data : data?.data || []

  return (
    <div className="flex flex-col">
      <Header title="Clientes" description="Gerencie seus clientes e leads" />

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum cliente ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">Os clientes aparecerão aqui quando receberem webhooks</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.email || "-"}</TableCell>
                    <TableCell>{formatDate(customer.created_at)}</TableCell>
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
