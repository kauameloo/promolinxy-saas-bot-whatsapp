// =====================================================
// WHATSAPP PAGE - Configuração do WhatsApp
// =====================================================

"use client"

import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Smartphone, QrCode, Wifi, WifiOff, RefreshCw } from "lucide-react"

export default function WhatsAppPage() {
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
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <WifiOff className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">Desconectado</p>
                  <p className="text-sm text-muted-foreground">Clique em conectar para iniciar</p>
                </div>
              </div>
              <Button className="mt-4 w-full">
                <Wifi className="mr-2 h-4 w-4" />
                Conectar WhatsApp
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
                <div className="text-center">
                  <QrCode className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">QR Code aparecerá aqui</p>
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full bg-transparent">
                <RefreshCw className="mr-2 h-4 w-4" />
                Gerar Novo QR Code
              </Button>
            </CardContent>
          </Card>
        </div>

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
                Node.js separado. Esta página é apenas para demonstração da interface. Em produção, você precisará
                configurar o servidor WhatsApp Engine.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
