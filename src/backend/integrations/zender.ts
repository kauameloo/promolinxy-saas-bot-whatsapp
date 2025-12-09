/**
 * Zender API Integration Module
 * Usado para enviar botões nativos do WhatsApp via Zender
 * quando whatsapp-web.js não suporta mais
 */

interface ZenderButton {
  id: string
  text: string
}

interface SendZenderButtonsParams {
  to: string
  message: string
  buttons: ZenderButton[]
  session?: string
}

interface ZenderResponse {
  success: boolean
  messageId?: string
  error?: any
}

const ZENDER_BASE_URL = "https://zender.growsoft.io"

/**
 * Envia mensagem com botões via Zender API
 * Endpoint: POST /api/sendButtonV2
 */
export async function sendZenderButtons({
  to,
  message,
  buttons,
  session = "default",
}: SendZenderButtonsParams): Promise<ZenderResponse> {
  const token = process.env.ZENDER_TOKEN

  if (!token) {
    console.error("[Zender] ZENDER_TOKEN não configurado")
    return { success: false, error: "ZENDER_TOKEN not configured" }
  }

  // Limita a 3 botões (limite do WhatsApp)
  const limitedButtons = buttons.slice(0, 3).map((btn) => ({
    id: btn.id,
    text: btn.text.substring(0, 20), // WhatsApp limita texto do botão
  }))

  const payload = {
    phone: to.replace("@c.us", "").replace(/\D/g, ""),
    message,
    session,
    buttons: limitedButtons,
  }

  console.log("[Zender] Enviando botões:", JSON.stringify(payload, null, 2))

  try {
    const response = await fetch(`${ZENDER_BASE_URL}/api/sendButtonV2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: token,
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as any

    if (!response.ok) {
      console.error("[Zender] Erro na resposta:", response.status, data)
      return { success: false, error: data }
    }

    console.log("[Zender] Sucesso:", data)
    return {
      success: true,
      messageId: data.messageId || data.id || undefined,
    }
  } catch (error) {
    console.error("[Zender] Erro ao enviar botões:", error)
    return { success: false, error }
  }
}

/**
 * Envia mensagem de texto simples via Zender API
 * Endpoint: POST /api/sendText
 */
export async function sendZenderText({
  to,
  message,
  session = "default",
}: {
  to: string
  message: string
  session?: string
}): Promise<ZenderResponse> {
  const token = process.env.ZENDER_TOKEN

  if (!token) {
    return { success: false, error: "ZENDER_TOKEN not configured" }
  }

  const payload = {
    phone: to.replace("@c.us", "").replace(/\D/g, ""),
    message,
    session,
  }

  try {
    const response = await fetch(`${ZENDER_BASE_URL}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: token,
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as any

    if (!response.ok) {
      return { success: false, error: data }
    }

    return { success: true, messageId: data.messageId || data.id }
  } catch (error) {
    return { success: false, error }
  }
}
