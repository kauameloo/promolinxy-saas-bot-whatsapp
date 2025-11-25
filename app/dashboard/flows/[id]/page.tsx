// =====================================================
// FLOW DETAIL PAGE - Detalhes e edição de fluxo
// =====================================================

"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { useApi, apiPost, apiPut, apiDelete } from "@/lib/hooks/use-api"
import { useAuth } from "@/lib/hooks/use-auth"
import type { MessageFlow, FlowMessage, CaktoEventType } from "@/lib/types"
import { EVENT_LABELS } from "@/lib/constants/default-flows"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Loader2, Trash2, Clock, GripVertical, Save, Pencil, Copy, Eye, Webhook, CheckCircle } from "lucide-react"
import Link from "next/link"
import { mutate } from "swr"
import { cn } from "@/lib/utils"

function MessagePreview({ content }: { content: string }) {
  const previewData = {
    nome: "João Silva",
    produto: "Curso de Marketing Digital",
    preco: "R$ 497,00",
    link_boleto: "https://exemplo.com/boleto/123",
    qr_code: "00020126580014BR.GOV.BCB.PIX...",
    link_checkout: "https://exemplo.com/checkout/abc",
    codigo_rastreio: "BR123456789BR",
  }

  let preview = content
  Object.entries(previewData).forEach(([key, value]) => {
    preview = preview.replace(new RegExp(`{{${key}}}`, "g"), value)
  })

  return (
    <div className="rounded-lg bg-emerald-500/10 p-4">
      <p className="mb-2 text-xs font-medium text-emerald-600">Preview da mensagem:</p>
      <p className="whitespace-pre-wrap text-sm">{preview}</p>
    </div>
  )
}

function MessageItem({
  message,
  index,
  flowId,
  token,
  onUpdate,
}: {
  message: FlowMessage
  index: number
  flowId: string
  token: string | null
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editData, setEditData] = useState({
    content: message.content,
    delay_minutes: message.delay_minutes,
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await apiPut(`/api/flows/${flowId}/messages/${message.id}`, editData, token)
      onUpdate()
      setIsEditing(false)
    } catch (error) {
      console.error("Error updating message:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await apiDelete(`/api/flows/${flowId}/messages/${message.id}`, token)
      onUpdate()
    } catch (error) {
      console.error("Error deleting message:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <div className="rounded-lg border-2 border-primary/50 bg-card p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Conteúdo da Mensagem</Label>
            <Textarea
              rows={6}
              value={editData.content}
              onChange={(e) => setEditData({ ...editData, content: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Delay (minutos)</Label>
            <Input
              type="number"
              min={0}
              value={editData.delay_minutes}
              onChange={(e) => setEditData({ ...editData, delay_minutes: Number.parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex gap-4">
        <div className="flex items-start">
          <GripVertical className="h-5 w-5 cursor-move text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {index + 1}
        </div>
        <div className="flex-1 space-y-2">
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>

          {showPreview && <MessagePreview content={message.content} />}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {message.delay_minutes === 0 ? "Envio imediato" : `${message.delay_minutes} min após anterior`}
            </div>

            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowPreview(!showPreview)}>
                <Eye className={cn("h-4 w-4", showPreview && "text-primary")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => navigator.clipboard.writeText(message.content)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WebhookUrlSection({ eventType }: { eventType: CaktoEventType }) {
  const [copied, setCopied] = useState(false)
  
  // Generate webhook URL for this specific event type
  const webhookUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/api/webhooks/cakto/${eventType}`
    : `/api/webhooks/cakto/${eventType}`

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <Webhook className="h-5 w-5" />
        Webhook para este Evento
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">URL do Webhook</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="font-mono text-sm"
            />
            <Button variant="outline" onClick={handleCopyUrl}>
              {copied ? <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
        <div className="rounded-lg bg-blue-500/10 p-4">
          <p className="text-sm text-blue-600">
            <strong>Instruções:</strong> Configure esta URL na plataforma Cakto para o evento <strong>{EVENT_LABELS[eventType]}</strong>.
            Cada tipo de evento tem sua própria URL de webhook.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Exemplo de Payload</Label>
          <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "customer": {
    "name": "João Silva",
    "phone": "5511999999999",
    "email": "joao@exemplo.com"
  },
  "product": {
    "id": "prod-123",
    "name": "Curso de Marketing",
    "price": 497.00
  },
  "payment": {
    "method": "${eventType.includes('pix') ? 'pix' : eventType.includes('boleto') ? 'boleto' : 'credit_card'}",
    "amount": 497.00,
    "status": "pending"${eventType.includes('boleto') ? ',\n    "boleto_url": "https://exemplo.com/boleto/123"' : ''}${eventType.includes('pix') ? ',\n    "pix_code": "00020126...",\n    "pix_qrcode": "https://exemplo.com/qr.png"' : ''}
  }
}`}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: flow, isLoading } = useApi<MessageFlow>(`/api/flows/${id}`)
  const { token } = useAuth()
  const router = useRouter()

  const [isAddingMessage, setIsAddingMessage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [newMessage, setNewMessage] = useState({
    content: "",
    delay_minutes: 0,
  })

  const handleToggleActive = async () => {
    if (!flow) return
    setIsSaving(true)
    try {
      await apiPut(`/api/flows/${id}`, { is_active: !flow.is_active }, token)
      mutate([`/api/flows/${id}`, token])
    } catch (error) {
      console.error("Error toggling flow:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddMessage = async () => {
    if (!newMessage.content) return
    setIsAddingMessage(true)
    try {
      await apiPost(`/api/flows/${id}/messages`, newMessage, token)
      mutate([`/api/flows/${id}`, token])
      setDialogOpen(false)
      setNewMessage({ content: "", delay_minutes: 0 })
    } catch (error) {
      console.error("Error adding message:", error)
    } finally {
      setIsAddingMessage(false)
    }
  }

  const handleDeleteFlow = async () => {
    try {
      await apiDelete(`/api/flows/${id}`, token)
      router.push("/dashboard/flows")
    } catch (error) {
      console.error("Error deleting flow:", error)
    }
  }

  const handleUpdateMessages = () => {
    mutate([`/api/flows/${id}`, token])
  }

  const messageTemplates = [
    {
      name: "Lembrete de Boleto",
      content: `Oi {{nome}}! 🎯

Seu boleto para *{{produto}}* no valor de *{{preco}}* está disponível.

📄 Acesse aqui: {{link_boleto}}

Qualquer dúvida, estou por aqui!`,
    },
    {
      name: "PIX Gerado",
      content: `{{nome}}, seu PIX foi gerado! ⚡

Valor: *{{preco}}*
Produto: *{{produto}}*

Copie o código abaixo:
\`\`\`
{{qr_code}}
\`\`\`

O pagamento é confirmado na hora!`,
    },
    {
      name: "Carrinho Abandonado",
      content: `Ei {{nome}}, vi que você deixou algo no carrinho! 🛒

O *{{produto}}* ainda está esperando por você.

Finalize agora: {{link_checkout}}

Posso te ajudar com alguma dúvida?`,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!flow) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-muted-foreground">Fluxo não encontrado</p>
        <Link href="/dashboard/flows">
          <Button variant="link">Voltar para fluxos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header title={flow.name} description={EVENT_LABELS[flow.event_type]} />

      <div className="flex-1 p-6">
        {/* Back button and actions */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard/flows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="active" className="text-sm">
                {flow.is_active ? "Ativo" : "Inativo"}
              </Label>
              <Switch id="active" checked={flow.is_active} onCheckedChange={handleToggleActive} disabled={isSaving} />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todas as mensagens deste fluxo serão removidas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteFlow}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Flow info */}
        <div className="mb-6 rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Informações do Fluxo</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Nome</Label>
              <p className="font-medium">{flow.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Evento</Label>
              <p className="font-medium">{EVENT_LABELS[flow.event_type]}</p>
            </div>
            {flow.description && (
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Descrição</Label>
                <p className="font-medium">{flow.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Webhook URL Section */}
        <WebhookUrlSection eventType={flow.event_type} />

        {/* Messages */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Mensagens ({flow.messages?.length || 0})</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Mensagem
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Mensagem</DialogTitle>
                  <DialogDescription>Crie uma nova mensagem para o fluxo ou use um template pronto.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                  {/* Templates */}
                  <div className="space-y-2">
                    <Label>Templates Prontos</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {messageTemplates.map((template) => (
                        <Button
                          key={template.name}
                          variant="outline"
                          size="sm"
                          className="h-auto py-2 text-left bg-transparent"
                          onClick={() => setNewMessage({ ...newMessage, content: template.content })}
                        >
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Conteúdo da Mensagem</Label>
                    <Textarea
                      placeholder="Use {{nome}}, {{produto}}, {{preco}}, {{link_boleto}}, {{qr_code}}, {{link_checkout}} para personalizar"
                      rows={8}
                      value={newMessage.content}
                      onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <p className="text-xs text-muted-foreground">Variáveis:</p>
                      {["nome", "produto", "preco", "link_boleto", "qr_code", "link_checkout", "codigo_rastreio"].map(
                        (v) => (
                          <button
                            key={v}
                            type="button"
                            className="rounded bg-muted px-2 py-0.5 text-xs font-mono hover:bg-muted/80"
                            onClick={() => setNewMessage({ ...newMessage, content: newMessage.content + `{{${v}}}` })}
                          >
                            {`{{${v}}}`}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {newMessage.content && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Preview</Label>
                        <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                          <Eye className="mr-2 h-4 w-4" />
                          {showPreview ? "Ocultar" : "Mostrar"} Preview
                        </Button>
                      </div>
                      {showPreview && <MessagePreview content={newMessage.content} />}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Delay (minutos após mensagem anterior)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newMessage.delay_minutes}
                      onChange={(e) =>
                        setNewMessage({
                          ...newMessage,
                          delay_minutes: Number.parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      0 = envio imediato, 60 = 1 hora depois, 1440 = 24 horas depois
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleAddMessage}
                    disabled={isAddingMessage || !newMessage.content}
                  >
                    {isAddingMessage ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar Mensagem
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {flow.messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">Nenhuma mensagem configurada</p>
              <p className="text-sm text-muted-foreground">Adicione mensagens para este fluxo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flow.messages?.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  index={index}
                  flowId={id}
                  token={token}
                  onUpdate={handleUpdateMessages}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
