// =====================================================
// WHATSAPP ENGINE TYPES - Backend Types
// =====================================================

// Eventos Cakto suportados
export type CaktoEventType =
  | "boleto_gerado"
  | "pix_gerado"
  | "picpay_gerado"
  | "openfinance_nubank_gerado"
  | "checkout_abandonment"
  | "purchase_approved"
  | "purchase_refused"

// Status de mensagem
export type MessageStatus = "pending" | "scheduled" | "sending" | "sent" | "delivered" | "read" | "failed"

// Status da sessão WhatsApp
export type WhatsAppSessionStatus = "disconnected" | "connecting" | "qr_ready" | "connected" | "error"

// Status do pedido
export type OrderStatus = "pending" | "paid" | "refused" | "refunded" | "cancelled"

// Planos do SaaS
export type PlanType = "free" | "starter" | "pro" | "enterprise"

// =====================================================
// INTERFACES DO BANCO DE DADOS
// =====================================================

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: PlanType
  status: "active" | "inactive" | "suspended"
  settings: TenantSettings
  created_at: Date
  updated_at: Date
}

export interface TenantSettings {
  webhook_secret?: string
  cakto_api_key?: string
  timezone?: string
  daily_message_limit?: number
  working_hours?: {
    start: string
    end: string
    days: number[]
  }
}

export interface WhatsAppSession {
  id: string
  tenant_id: string
  session_name: string
  phone_number?: string
  status: WhatsAppSessionStatus
  qr_code?: string
  session_data?: Record<string, unknown>
  last_connected?: Date
  created_at: Date
  updated_at: Date
}

export interface ScheduledMessage {
  id: string
  tenant_id: string
  customer_id: string
  order_id?: string
  flow_id?: string
  flow_message_id?: string
  phone: string
  message_content: string
  scheduled_for: Date
  status: "pending" | "processing" | "sent" | "failed" | "cancelled"
  attempts: number
  last_attempt?: Date
  error_message?: string
  created_at: Date
}

export interface MessageLog {
  id: string
  tenant_id: string
  customer_id?: string
  order_id?: string
  flow_id?: string
  phone: string
  message_content: string
  status: MessageStatus
  sent_at?: Date
  delivered_at?: Date
  read_at?: Date
  error_message?: string
  metadata: Record<string, unknown>
  created_at: Date
}

// =====================================================
// WHATSAPP ENGINE TYPES
// =====================================================

export interface WhatsAppMessage {
  to: string
  content: string
  mediaUrl?: string
  mediaType?: "image" | "video" | "audio" | "document"
}

export interface WhatsAppSessionInfo {
  id: string
  status: "disconnected" | "connecting" | "qr_ready" | "connected" | "error"
  qrCode?: string
  phoneNumber?: string
  lastConnected?: Date
}

export interface WhatsAppEventHandlers {
  onQRCode?: (qr: string) => void
  onReady?: (phoneNumber: string) => void
  onDisconnected?: (reason: string) => void
  onMessage?: (message: IncomingMessage) => void
  onMessageStatus?: (status: MessageStatusUpdate) => void
}

export interface IncomingMessage {
  from: string
  body: string
  timestamp: Date
  isGroup: boolean
  mediaUrl?: string
}

export interface MessageStatusUpdate {
  messageId: string
  status: "sent" | "delivered" | "read" | "failed"
  timestamp: Date
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
}
