// =====================================================
// WHATSAPP ENGINE TYPES
// =====================================================

export interface WhatsAppMessage {
  to: string
  content: string
  mediaUrl?: string
  mediaType?: "image" | "video" | "audio" | "document"
}

export interface WhatsAppSession {
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
