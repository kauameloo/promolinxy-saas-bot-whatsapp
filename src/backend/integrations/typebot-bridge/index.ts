// =====================================================
// TYPEBOT BRIDGE - Main Entry Point
// =====================================================

export { TypeBotClient, createTypeBotClient } from "./typebot-client"
export type {
  TypeBotMessage,
  TypeBotInput,
  TypeBotStartResponse,
  TypeBotContinueResponse,
} from "./typebot-client"

export { MessageMapper, createMessageMapper } from "./message-mapper"
export type {
  WhatsAppMessage,
  WhatsAppTextMessage,
  WhatsAppMediaMessage,
  WhatsAppButtonsMessage,
  WhatsAppListMessage,
  MapperConfig,
} from "./message-mapper"

export { TypeBotBridge, createTypeBotBridge } from "./bridge"
export type {
  BridgeConfig,
  InboundMessage,
  OutboundMessage,
  InputType,
} from "./bridge"

export {
  redisClient,
  getOrCreateSession,
  updateSession,
  getSession,
  deleteSession,
  storeLastOptions,
  getLastOptions,
  updateLastActivity,
  getActiveSessions,
  closeRedis,
  REDIS_KEYS,
  DEFAULT_SESSION_TTL,
} from "./redis-client"
export type { TypeBotSession } from "./redis-client"
