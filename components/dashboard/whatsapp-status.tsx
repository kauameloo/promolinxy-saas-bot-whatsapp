"use client"

// =====================================================
// WHATSAPP STATUS - Status da conexão WhatsApp
// =====================================================

import { cn } from "@/lib/utils"
import { Smartphone, Wifi, WifiOff, QrCode, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WhatsAppSessionStatus } from "@/lib/types"

interface WhatsAppStatusProps {
  status: WhatsAppSessionStatus
  onConnect?: () => void
}

const statusConfig: Record<WhatsAppSessionStatus, { label: string; color: string; icon: typeof Wifi }> = {
  connected: { label: "Conectado", color: "text-green-500", icon: Wifi },
  connecting: { label: "Conectando...", color: "text-amber-500", icon: Wifi },
  qr_ready: { label: "Aguardando QR Code", color: "text-blue-500", icon: QrCode },
  disconnected: { label: "Desconectado", color: "text-muted-foreground", icon: WifiOff },
  error: { label: "Erro", color: "text-destructive", icon: AlertCircle },
}

export function WhatsAppStatus({ status, onConnect }: WhatsAppStatusProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">WhatsApp</h3>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
          <Smartphone className="h-5 w-5 text-green-500" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
      </div>

      {status === "disconnected" && (
        <Button className="mt-4 w-full" onClick={onConnect}>
          Conectar WhatsApp
        </Button>
      )}

      {status === "connected" && <p className="mt-4 text-sm text-muted-foreground">Pronto para enviar mensagens</p>}
    </div>
  )
}
