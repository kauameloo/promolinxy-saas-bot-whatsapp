// =====================================================
// FLOWS PAGE - Gerenciamento de fluxos
// =====================================================

"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { useApi, apiPost } from "@/lib/hooks/use-api"
import { useAuth } from "@/lib/hooks/use-auth"
import type { MessageFlow, CaktoEventType } from "@/lib/types"
import { EVENT_LABELS, EVENT_COLORS, SUPPORTED_EVENTS } from "@/lib/constants/default-flows"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Plus, MessageSquare, Loader2, Sparkles, ChevronRight } from "lucide-react"
import Link from "next/link"
import { mutate } from "swr"

export default function FlowsPage() {
  const { data: flows, isLoading } = useApi<MessageFlow[]>("/api/flows")
  const { token } = useAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newFlow, setNewFlow] = useState({
    name: "",
    event_type: "" as CaktoEventType | "",
    description: "",
  })

  const handleCreateFlow = async () => {
    if (!newFlow.name || !newFlow.event_type) return

    setIsCreating(true)
    try {
      await apiPost("/api/flows", newFlow, token)
      mutate(["/api/flows", token])
      setDialogOpen(false)
      setNewFlow({ name: "", event_type: "", description: "" })
    } catch (error) {
      console.error("Error creating flow:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSeedFlows = async () => {
    setIsSeeding(true)
    try {
      await apiPost("/api/flows/seed", {}, token)
      mutate(["/api/flows", token])
    } catch (error) {
      console.error("Error seeding flows:", error)
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Fluxos de Mensagens" description="Gerencie seus fluxos de automação" />

      <div className="flex-1 p-6">
        {/* Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Fluxo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Fluxo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome do Fluxo</Label>
                    <Input
                      placeholder="Ex: Recuperação de Boleto"
                      value={newFlow.name}
                      onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Evento</Label>
                    <Select
                      value={newFlow.event_type}
                      onValueChange={(value) => setNewFlow({ ...newFlow, event_type: value as CaktoEventType })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o evento" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_EVENTS.map((event) => (
                          <SelectItem key={event} value={event}>
                            {EVENT_LABELS[event]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição (opcional)</Label>
                    <Input
                      placeholder="Descrição do fluxo"
                      value={newFlow.description}
                      onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value })}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreateFlow}
                    disabled={isCreating || !newFlow.name || !newFlow.event_type}
                  >
                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar Fluxo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {flows?.length === 0 && (
              <Button variant="outline" onClick={handleSeedFlows} disabled={isSeeding}>
                {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Criar Fluxos Padrão
              </Button>
            )}
          </div>
        </div>

        {/* Flows List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : flows?.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum fluxo criado</h3>
            <p className="mt-2 text-sm text-muted-foreground">Crie seu primeiro fluxo ou use os fluxos padrão</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flows?.map((flow) => (
              <Link
                key={flow.id}
                href={`/dashboard/flows/${flow.id}`}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        EVENT_COLORS[flow.event_type]?.replace("bg-", "bg-") + "/10",
                      )}
                    >
                      <MessageSquare
                        className={cn("h-5 w-5", EVENT_COLORS[flow.event_type]?.replace("bg-", "text-"))}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{flow.name}</h3>
                      <p className="text-sm text-muted-foreground">{EVENT_LABELS[flow.event_type]}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{flow.messages?.length || 0} mensagens</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("text-xs font-medium", flow.is_active ? "text-green-500" : "text-muted-foreground")}
                    >
                      {flow.is_active ? "Ativo" : "Inativo"}
                    </span>
                    <div
                      className={cn("h-2 w-2 rounded-full", flow.is_active ? "bg-green-500" : "bg-muted-foreground")}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
