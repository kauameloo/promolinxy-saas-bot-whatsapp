// =====================================================
// SETTINGS PAGE - Configurações do sistema
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Webhook, Key, Bell } from "lucide-react"

export default function SettingsPage() {
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
                      value={typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/cakto` : ""}
                      className="font-mono text-sm"
                    />
                    <Button variant="outline">Copiar</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure esta URL na plataforma Cakto para receber eventos
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Secret do Webhook (opcional)</Label>
                  <Input type="password" placeholder="Seu secret para validação de assinatura" />
                  <p className="text-sm text-muted-foreground">Use para validar que os webhooks vêm da Cakto</p>
                </div>

                <Button>Salvar Configurações</Button>
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
                  <Button variant="outline" size="sm">
                    Ativar
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">WhatsApp desconectado</p>
                    <p className="text-sm text-muted-foreground">Seja notificado quando a conexão cair</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Ativar
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">Relatório diário</p>
                    <p className="text-sm text-muted-foreground">Receba um resumo diário das atividades</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Ativar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
