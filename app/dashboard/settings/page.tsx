// =====================================================
// SETTINGS PAGE - Configurações do sistema
// =====================================================

"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { useApi, apiPut } from "@/lib/hooks/use-api"
import { useAuth } from "@/lib/hooks/use-auth"
import { Webhook, Key, Bell, Loader2, CheckCircle, Copy } from "lucide-react"
import { mutate } from "swr"

interface Settings {
  webhook_secret?: { value: string }
  notifications?: {
    errors_enabled?: boolean
    disconnect_enabled?: boolean
    daily_report_enabled?: boolean
  }
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useApi<Settings>("/api/settings")
  const { token } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const [webhookSecret, setWebhookSecret] = useState("")
  const [notifications, setNotifications] = useState({
    errors_enabled: false,
    disconnect_enabled: false,
    daily_report_enabled: false,
  })

  // Carrega valores quando settings carregar
  useEffect(() => {
    if (settings) {
      setWebhookSecret(settings.webhook_secret?.value || "")
      setNotifications({
        errors_enabled: settings.notifications?.errors_enabled || false,
        disconnect_enabled: settings.notifications?.disconnect_enabled || false,
        daily_report_enabled: settings.notifications?.daily_report_enabled || false,
      })
    }
  }, [settings])

  const handleSaveWebhook = async () => {
    setIsSaving(true)
    try {
      await apiPut("/api/settings", { webhook_secret: webhookSecret }, token)
      mutate(["/api/settings", token])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error("Error saving settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleNotification = async (key: keyof typeof notifications) => {
    const newNotifications = {
      ...notifications,
      [key]: !notifications[key],
    }
    setNotifications(newNotifications)
    
    try {
      await apiPut("/api/settings", { notifications: newNotifications }, token)
      mutate(["/api/settings", token])
    } catch (error) {
      console.error("Error saving notification:", error)
      // Reverte em caso de erro
      setNotifications(notifications)
    }
  }

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/cakto` : ""

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header title="Configurações" description="Configure seu sistema de automação" />

      <div className="flex-1 p-6">
        <Tabs defaultValue="webhook" className="space-y-6">
          <TabsList>
            <TabsTrigger value="webhook" className="gap-2">
              <Webhook className="h-4 w-4" />
              Webhook
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="webhook">
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Webhook</CardTitle>
                <CardDescription>Configure a URL de webhook para receber eventos da Cakto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={webhookUrl}
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" onClick={handleCopyUrl}>
                      {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure esta URL na plataforma Cakto para receber eventos
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Secret do Webhook (opcional)</Label>
                  <Input 
                    type="password" 
                    placeholder="Seu secret para validação de assinatura"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">Use para validar que os webhooks vêm da Cakto</p>
                </div>

                <div className="flex items-center gap-4">
                  <Button onClick={handleSaveWebhook} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar Configurações
                  </Button>
                  {saved && (
                    <span className="flex items-center gap-2 text-sm text-green-500">
                      <CheckCircle className="h-4 w-4" />
                      Salvo com sucesso!
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Gerencie suas chaves de API para integrações</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Key className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold">Nenhuma API Key</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Crie uma API Key para integrar com outros sistemas
                  </p>
                  <Button className="mt-4">Criar API Key</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Configure como você deseja receber notificações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">Erros de envio</p>
                    <p className="text-sm text-muted-foreground">Receba notificações quando mensagens falharem</p>
                  </div>
                  <Switch 
                    checked={notifications.errors_enabled}
                    onCheckedChange={() => handleToggleNotification("errors_enabled")}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">WhatsApp desconectado</p>
                    <p className="text-sm text-muted-foreground">Seja notificado quando a conexão cair</p>
                  </div>
                  <Switch 
                    checked={notifications.disconnect_enabled}
                    onCheckedChange={() => handleToggleNotification("disconnect_enabled")}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">Relatório diário</p>
                    <p className="text-sm text-muted-foreground">Receba um resumo diário das atividades</p>
                  </div>
                  <Switch 
                    checked={notifications.daily_report_enabled}
                    onCheckedChange={() => handleToggleNotification("daily_report_enabled")}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
