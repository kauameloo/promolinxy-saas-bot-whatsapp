/**
 * Integração Zender - Botões Nativos WhatsApp (API correta)
 */

interface ZenderButton {
  id: string;
  text: string;
}

interface SendZenderButtonsParams {
  to: string;
  message: string;
  buttons: ZenderButton[];
  session?: string;
}

interface ZenderResponse {
  success: boolean;
  messageId?: string;
  error?: any;
}

const ZENDER_BASE_URL =
  process.env.ZENDER_HOST || "https://zender.growsoft.io";

/**
 * ENVIO DE BOTÕES NATIVOS - API CORRETA /api/sendButtonV2
 */
export async function sendZenderButtons({
  to,
  message,
  buttons,
  session = "default",
}: SendZenderButtonsParams): Promise<ZenderResponse> {
  const token = process.env.ZENDER_TOKEN;

  if (!token) {
    console.error("[Zender] ZENDER_TOKEN não configurado");
    return { success: false, error: "ZENDER_TOKEN not configured" };
  }

  const chatId = `${to.replace(/\D/g, "")}@c.us`;

  const payload = {
    chatId,
    text: message,
    session,
    buttons: buttons.slice(0, 3).map((b) => ({
      id: b.id,
      text: b.text.substring(0, 20),
    })),
  };

  console.log("[Zender] Enviando botões:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${ZENDER_BASE_URL}/api/sendButtonV2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: token,
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let data: any;

    // 1. Tenta parsear JSON
    try {
      data = JSON.parse(raw);
    } catch {
      // 2. Não é JSON → usar como messageId
      console.warn("[Zender] RAW não é JSON, usando como messageId:", raw);

      return {
        success: true,
        messageId: raw,
      };
    }

    // 3. JSON válido mas HTTP erro
    if (!response.ok) {
      return { success: false, error: data };
    }

    // 4. Sucesso com JSON
    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error("[Zender] Erro ao enviar botões:", error);
    return { success: false, error };
  }
}