// =====================================================
// TYPES - Tipos TypeScript do Sistema
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

// Eventos Kirvano suportados
export type KirvanoEventType =
  | "order.created"
  | "order.approved"
  | "order.refused"
  | "order.refunded"
  | "order.cancelled"
  | "payment.pending"
  | "payment.approved"
  | "payment.refused"
  | "payment.refunded"
  | "cart.abandoned"

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
  kirvano_webhook_secret?: string
  kirvano_api_key?: string
  timezone?: string
  daily_message_limit?: number
  working_hours?: {
    start: string
    end: string
    days: number[]
  }
}

export interface User {
  id: string
  tenant_id: string
  email: string
  password_hash: string
  name: string
  role: "admin" | "user" | "viewer"
  avatar_url?: string
  is_active: boolean
  last_login?: Date
  created_at: Date
  updated_at: Date
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

export interface MessageTemplate {
  id: string
  tenant_id: string
  name: string
  event_type: CaktoEventType | KirvanoEventType
  message_order: number
  content: string
  delay_minutes: number
  is_active: boolean
  variables: string[]
  created_at: Date
  updated_at: Date
}

export interface MessageFlow {
  id: string
  tenant_id: string
  name: string
  event_type: CaktoEventType | KirvanoEventType
  description?: string
  is_active: boolean
  settings: FlowSettings
  created_at: Date
  updated_at: Date
  messages?: FlowMessage[]
}

export interface FlowSettings {
  stop_on_reply?: boolean
  respect_working_hours?: boolean
  max_retries?: number
}

export interface FlowMessage {
  id: string
  flow_id: string
  message_order: number
  content: string
  delay_minutes: number
  media_url?: string
  media_type?: "image" | "video" | "audio" | "document"
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Customer {
  id: string
  tenant_id: string
  external_id?: string
  name: string
  email?: string
  phone: string
  document?: string
  metadata: Record<string, unknown>
  tags: string[]
  created_at: Date
  updated_at: Date
}

export interface Order {
  id: string
  tenant_id: string
  customer_id?: string
  external_id?: string
  product_name?: string
  product_id?: string
  amount?: number
  status: OrderStatus
  payment_method?: string
  payment_url?: string
  pix_code?: string
  boleto_url?: string
  checkout_url?: string
  metadata: Record<string, unknown>
  created_at: Date
  updated_at: Date
  customer?: Customer
}

export interface WebhookEvent {
  id: string
  tenant_id: string
  event_type: CaktoEventType | KirvanoEventType
  source: string
  payload: CaktoWebhookPayload | KirvanoWebhookPayload | any
  processed: boolean
  processed_at?: Date
  error_message?: string
  retry_count: number
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

export interface AnalyticsDaily {
  id: string
  tenant_id: string
  date: Date
  messages_sent: number
  messages_delivered: number
  messages_read: number
  messages_failed: number
  webhooks_received: number
  conversions: number
  revenue: number
  created_at: Date
}

export interface ApiKey {
  id: string
  tenant_id: string
  name: string
  key_hash: string
  key_prefix: string
  permissions: string[]
  last_used?: Date
  expires_at?: Date
  is_active: boolean
  created_at: Date
}

// =====================================================
// PAYLOADS DA CAKTO
// =====================================================

export interface CaktoWebhookPayload {
  event: CaktoEventType
  transaction_id?: string
  customer?: {
    name: string
    email?: string
    phone: string
    document?: string
  }
  product?: {
    id: string
    name: string
    price: number
  }
  payment?: {
    method: string
    amount: number
    status: string
    boleto_url?: string
    pix_code?: string
    pix_qrcode?: string
    checkout_url?: string
  }
  metadata?: Record<string, unknown>
  timestamp?: string
}

// =====================================================
// PAYLOADS DA KIRVANO
// =====================================================

export interface KirvanoWebhookPayload {
  event: KirvanoEventType
  order_id?: string
  transaction_id?: string
  customer?: {
    name: string
    email?: string
    phone: string
    document?: string
  }
  product?: {
    id: string
    name: string
    price: number
  }
  payment?: {
    method: string
    amount: number
    status: string
    boleto_url?: string
    pix_code?: string
    pix_qrcode?: string
    checkout_url?: string
  }
  metadata?: Record<string, unknown>
  timestamp?: string
}

// =====================================================
// RESPOSTAS DA API
// =====================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// =====================================================
// DASHBOARD STATS
// =====================================================

export interface DashboardStats {
  totalMessages: number
  messagesDelivered: number
  messagesFailed: number
  totalCustomers: number
  totalOrders: number
  conversionRate: number
  revenue: number
  whatsappStatus: WhatsAppSessionStatus
}

export interface ChartDataPoint {
  date: string
  sent: number
  delivered: number
  read: number
  failed: number
}

// =====================================================
// AUTH
// =====================================================

export interface JWTPayload {
  userId: string
  tenantId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: Omit<User, "password_hash">
}

// =====================================================
// MESSAGE VARIABLES
// =====================================================

export interface MessageVariables {
  nome: string
  produto?: string
  preco?: string
  link_boleto?: string
  qr_code?: string
  link_checkout?: string
  link_pix?: string
  email?: string
  telefone?: string
  [key: string]: string | undefined
}
