// =====================================================
// TYPEBOT BRIDGE - Integration Service
// Service layer for integrating TypeBot bridge with WhatsApp engine
// =====================================================

import { createTypeBotBridge, InboundMessage, OutboundMessage, BridgeConfig } from "../integrations/typebot-bridge"
import { query, queryOne } from "./db"

// Store active bridges per tenant
const activeBridges = new Map<string, ReturnType<typeof createTypeBotBridge>>()

interface TypeBotFlow {
  id: string
  tenant_id: string
  name: string
  flow_url: string
  token?: string
  is_active: boolean
  settings: {
    preferReupload?: boolean
    enableUrlRewrite?: boolean
    urlRewriteMap?: Record<string, string>
    delays?: {
      fixed?: number
      perMessage?: number
      random?: { min: number; max: number }
    }
  }
}

/**
 * Initialize TypeBot bridge for a tenant
 */
export async function initializeTypeBotBridge(tenantId: string): Promise<void> {
  try {
    // Check if TypeBot is enabled globally
    if (process.env.TYPEBOT_ENABLED !== "true") {
      console.log(`[TypeBot Service] TypeBot disabled globally`)
      return
    }

    // Get active TypeBot flow for tenant
    const flow = await queryOne<TypeBotFlow>(
      `SELECT * FROM typebot_flows WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
      [tenantId]
    )

    if (!flow) {
      console.log(`[TypeBot Service] No active TypeBot flow for tenant ${tenantId}`)
      return
    }

    // Create bridge configuration
    const config: BridgeConfig = {
      flowUrl: flow.flow_url,
      token: flow.token || process.env.TYPEBOT_TOKEN,
      tenantId,
      preferReupload: flow.settings?.preferReupload ?? true,
      enableUrlRewrite: flow.settings?.enableUrlRewrite ?? false,
      urlRewriteMap: flow.settings?.urlRewriteMap,
      delays: flow.settings?.delays,
    }

    // Create and store bridge
    const bridge = createTypeBotBridge(config)
    activeBridges.set(tenantId, bridge)

    console.log(`[TypeBot Service] Bridge initialized for tenant ${tenantId}`)
  } catch (error) {
    console.error(`[TypeBot Service] Failed to initialize bridge for tenant ${tenantId}:`, error)
  }
}

/**
 * Get TypeBot bridge for a tenant
 */
export function getTypeBotBridge(tenantId: string): ReturnType<typeof createTypeBotBridge> | null {
  return activeBridges.get(tenantId) || null
}

/**
 * Handle incoming WhatsApp message with TypeBot
 */
export async function handleTypeBotMessage(
  tenantId: string,
  from: string,
  body: string,
  messageType: "text" | "button_response" | "list_response" = "text",
  optionId?: string
): Promise<OutboundMessage | null> {
  try {
    let bridge = getTypeBotBridge(tenantId)

    // Initialize bridge if not already done
    if (!bridge) {
      await initializeTypeBotBridge(tenantId)
      bridge = getTypeBotBridge(tenantId)
    }

    if (!bridge) {
      console.log(`[TypeBot Service] No bridge available for tenant ${tenantId}`)
      return null
    }

    // Prepare inbound message
    const inbound: InboundMessage = {
      from,
      body,
      type: messageType,
      ...(messageType === "button_response" && { buttonId: optionId }),
      ...(messageType === "list_response" && { listId: optionId }),
    }

    // Handle through bridge
    const outbound = await bridge.handleInbound(inbound)

    return outbound
  } catch (error) {
    console.error(`[TypeBot Service] Error handling message:`, error)
    return null
  }
}

/**
 * Remove TypeBot bridge for a tenant
 */
export function removeTypeBotBridge(tenantId: string): void {
  activeBridges.delete(tenantId)
  console.log(`[TypeBot Service] Bridge removed for tenant ${tenantId}`)
}

/**
 * Get all active bridges
 */
export function getAllActiveBridges(): Map<string, ReturnType<typeof createTypeBotBridge>> {
  return activeBridges
}

/**
 * Update TypeBot bridge configuration
 */
export async function updateTypeBotConfig(tenantId: string, flowId: string): Promise<void> {
  try {
    const bridge = getTypeBotBridge(tenantId)
    if (!bridge) {
      console.log(`[TypeBot Service] No bridge to update for tenant ${tenantId}`)
      return
    }

    // Get updated flow configuration
    const flow = await queryOne<TypeBotFlow>(
      `SELECT * FROM typebot_flows WHERE id = $1 AND tenant_id = $2`,
      [flowId, tenantId]
    )

    if (!flow) {
      console.log(`[TypeBot Service] Flow ${flowId} not found`)
      return
    }

    // Update bridge config
    bridge.updateConfig({
      flowUrl: flow.flow_url,
      token: flow.token,
      preferReupload: flow.settings?.preferReupload,
      enableUrlRewrite: flow.settings?.enableUrlRewrite,
      urlRewriteMap: flow.settings?.urlRewriteMap,
      delays: flow.settings?.delays,
    })

    console.log(`[TypeBot Service] Bridge config updated for tenant ${tenantId}`)
  } catch (error) {
    console.error(`[TypeBot Service] Failed to update bridge config:`, error)
  }
}
