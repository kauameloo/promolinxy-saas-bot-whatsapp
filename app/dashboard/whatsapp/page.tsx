// =====================================================
// WHATSAPP PAGE - Configuração do WhatsApp
// =====================================================

"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useApi, apiPost } from "@/lib/hooks/use-api"
import type { WhatsAppSession } from "@/lib/types"
import { Smartphone, QrCode, Wifi, WifiOff, RefreshCw, Loader2, Send, CheckCircle } from "lucide-react"
import { mutate } from "swr"
import { cn } from "@/lib/utils"

const statusConfig = {
  disconnected: { label: "Desconectado", icon: WifiOff, color: "text-muted-foreground", bg: "bg-muted" },
  connecting: { label: "Conectando...", icon: Loader2, color: "text-amber-500", bg: "bg-amber-500/10" },
  qr_ready: { label: "Aguardando QR Code", icon: QrCode, color: "text-blue-500", bg: "bg-blue-500/10" },
  connected: { label: "Conectado", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  error: { label: "Erro na conexão", icon: WifiOff, color: "text-red-500", bg: "bg-red-500/10" },
}

export default function WhatsAppPage() {
  const { data: session, isLoading } = useApi<WhatsAppSession>("/api/whatsapp/status")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [sendSuccess, setSendSuccess] = useState(false)

  const status = session?.status || "disconnected"
  const statusInfo = statusConfig[status] || statusConfig.disconnected
  const StatusIcon = statusInfo.icon

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      await apiPost("/api/whatsapp/status", {})
      mutate("/api/whatsapp/status")
    } catch (error) {
      console.error("Error connecting:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSendMessage = async () => {
    if (!phone || !message) return
    setIsSending(true)
    setSendSuccess(false)
    try {
      await apiPost("/api/whatsapp/send", { phone, message })
      setSendSuccess(true)
      setPhone("")
      setMessage("")
      setTimeout(() => setSendSuccess(false), 3000)
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="WhatsApp" description="Configure sua conexão com o WhatsApp" />

      <div className="flex-1 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Status da Conexão
              </CardTitle>
              <CardDescription>Estado atual da sua sessão WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", statusInfo.bg)}>
                  <StatusIcon
                    className={cn("h-6 w-6", statusInfo.color, status === "connecting" && "animate-spin")}
                  />
                </div>
                <div>
                  <p className="font-semibold">{statusInfo.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {session?.phone_number ? `Número: ${session.phone_number}` : "Clique em conectar para iniciar"}
                  </p>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={handleConnect} disabled={isConnecting || isLoading}>
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="mr-2 h-4 w-4" />
                )}
                {status === "connected" ? "Reconectar" : "Conectar WhatsApp"}
              </Button>
            </CardContent>
          </Card>

          {/* QR Code Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code
              </CardTitle>
              <CardDescription>Escaneie o QR Code com seu WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50">
                {session?.qr_code && status === "qr_ready" ? (
                  <div className="text-center p-4">
                    <div className="bg-white p-4 rounded-lg">
                      {/* In production, this would render a real QR code */}
                      <QrCode className="mx-auto h-32 w-32 text-gray-800" />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Escaneie com seu WhatsApp</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <QrCode className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {status === "connected" ? "Conectado! QR Code não necessário." : "QR Code aparecerá aqui"}
                    </p>
                  </div>
                )}
              </div>
              <Button variant="outline" className="mt-4 w-full bg-transparent" onClick={handleConnect} disabled={isConnecting}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isConnecting && "animate-spin")} />
                Gerar Novo QR Code
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Test Message Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Mensagem de Teste
            </CardTitle>
            <CardDescription>Envie uma mensagem para testar a conexão</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Número do Telefone</Label>
                <Input
                  id="phone"
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Formato: código do país + DDD + número</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  placeholder="Digite sua mensagem de teste..."
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleSendMessage} disabled={isSending || !phone || !message}>
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Enviar Mensagem
              </Button>
              {sendSuccess && (
                <span className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  Mensagem enviada com sucesso!
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Como conectar</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>Clique em "Conectar WhatsApp" para gerar o QR Code</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Vá em Configurações &gt; Dispositivos conectados &gt; Conectar dispositivo</li>
              <li>Escaneie o QR Code exibido na tela</li>
              <li>Aguarde a conexão ser estabelecida</li>
            </ol>
            <div className="mt-4 rounded-lg bg-amber-500/10 p-4">
              <p className="text-sm text-amber-600">
                <strong>Importante:</strong> A conexão WhatsApp usa a biblioteca whatsapp-web.js que requer um servidor
                Node.js separado. Em produção, configure o servidor WhatsApp Engine no Docker para funcionalidade completa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

