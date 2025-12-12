// =====================================================
// DEFAULT FLOWS - Fluxos de mensagens padrão
// =====================================================

import type { CaktoEventType, KirvanoEventType } from "@/lib/types"

interface DefaultFlowMessage {
  content: string
  delay_minutes: number
}

interface DefaultFlow {
  name: string
  event_type: CaktoEventType
  description: string
  messages: DefaultFlowMessage[]
}

export const DEFAULT_FLOWS: DefaultFlow[] = [
  // =====================================================
  // BOLETO GERADO - 3 mensagens com urgência crescente
  // =====================================================
  {
    name: "Boleto Gerado - Conversão",
    event_type: "boleto_gerado",
    description: "Fluxo de conversão para boletos gerados",
    messages: [
      {
        content: `Olá {{nome}}! 👋

Vi que você acabou de gerar o boleto do *{{produto}}*!

Ótima escolha! 🎯

Para facilitar, aqui está seu boleto:
{{link_boleto}}

O pagamento é simples e rápido. Qualquer dúvida, estou aqui!`,
        delay_minutes: 0,
      },
      {
        content: `{{nome}}, tudo bem? 

Passando para lembrar que seu boleto do *{{produto}}* vence em breve!

💡 *Dica:* Muitos bancos permitem pagar pelo app em segundos.

Não perca essa oportunidade! O valor de *{{preco}}* é um investimento que vai transformar seus resultados.

{{link_boleto}}`,
        delay_minutes: 1440, // 24 horas
      },
      {
        content: `{{nome}}, última chance! ⚠️

Seu boleto do *{{produto}}* está prestes a vencer.

Sei que às vezes a correria do dia a dia faz a gente esquecer, mas não deixe essa oportunidade escapar!

Por apenas *{{preco}}*, você terá acesso a tudo que precisa para alcançar seus objetivos.

👉 {{link_boleto}}

Pague agora e garanta seu acesso!`,
        delay_minutes: 2880, // 48 horas após a primeira
      },
    ],
  },

  // =====================================================
  // PIX GERADO - 2 mensagens curtas e diretas
  // =====================================================
  {
    name: "PIX Gerado - Conversão Rápida",
    event_type: "pix_gerado",
    description: "Fluxo rápido para pagamentos via PIX",
    messages: [
      {
        content: `{{nome}}, seu PIX está pronto! 🚀

*{{produto}}* por apenas *{{preco}}*

É só copiar o código abaixo e colar no seu banco:

\`\`\`
{{qr_code}}
\`\`\`

O pagamento é instantâneo e seu acesso será liberado na hora! ⚡`,
        delay_minutes: 0,
      },
      {
        content: `Ei {{nome}}! 

Notei que o PIX ainda está pendente. Tudo bem?

Se precisar de ajuda ou tiver alguma dúvida sobre o *{{produto}}*, é só me chamar!

Seu código PIX ainda está válido:
\`\`\`
{{qr_code}}
\`\`\`

Estou aqui para ajudar! 🤝`,
        delay_minutes: 30,
      },
    ],
  },

  // =====================================================
  // PICPAY GERADO
  // =====================================================
  {
    name: "PicPay Gerado - Conversão",
    event_type: "picpay_gerado",
    description: "Fluxo para pagamentos via PicPay",
    messages: [
      {
        content: `{{nome}}, seu pagamento via PicPay está pronto! 💜

*{{produto}}* - *{{preco}}*

Acesse o link abaixo para pagar:
{{link_checkout}}

É rápido, seguro e você ainda pode ganhar cashback! 💰`,
        delay_minutes: 0,
      },
      {
        content: `{{nome}}, ainda dá tempo! 

Seu link do PicPay continua disponível:
{{link_checkout}}

Não deixe escapar o *{{produto}}*!`,
        delay_minutes: 60,
      },
    ],
  },

  // =====================================================
  // OPENFINANCE NUBANK
  // =====================================================
  {
    name: "Nubank OpenFinance - Conversão",
    event_type: "openfinance_nubank_gerado",
    description: "Fluxo para pagamentos via Nubank OpenFinance",
    messages: [
      {
        content: `{{nome}}, pagamento Nubank disponível! 💜

Pague o *{{produto}}* diretamente pelo seu Nubank de forma super rápida e segura!

Valor: *{{preco}}*

{{link_checkout}}

É só autorizar no app e pronto! ✨`,
        delay_minutes: 0,
      },
      {
        content: `{{nome}}, seu pagamento via Nubank ainda está pendente!

Link: {{link_checkout}}

Qualquer dúvida, me chama! 😊`,
        delay_minutes: 45,
      },
    ],
  },

  // =====================================================
  // CHECKOUT ABANDONMENT - 3 mensagens com gatilhos mentais
  // =====================================================
  {
    name: "Carrinho Abandonado - Recuperação",
    event_type: "checkout_abandonment",
    description: "Fluxo de recuperação de carrinhos abandonados",
    messages: [
      {
        content: `Ei {{nome}}! 👋

Vi que você estava quase garantindo o *{{produto}}*, mas não finalizou...

Aconteceu alguma coisa? Posso te ajudar com alguma dúvida?

Seu carrinho ainda está salvo:
{{link_checkout}}

É só continuar de onde parou! 😊`,
        delay_minutes: 30,
      },
      {
        content: `{{nome}}, uma reflexão rápida:

Você chegou até o checkout do *{{produto}}* por um motivo, certo?

Algo nesse produto chamou sua atenção. Algo fez você pensar "isso pode me ajudar".

Por apenas *{{preco}}*, você pode transformar essa vontade em realidade.

👉 {{link_checkout}}

O que está te impedindo? Me conta que eu ajudo!`,
        delay_minutes: 180, // 3 horas
      },
      {
        content: `{{nome}}, última mensagem sobre isso, prometo! 🤝

O *{{produto}}* ainda está te esperando por *{{preco}}*.

Sei que tomar decisões de investimento requer confiança. Por isso, quero que você saiba:

✅ Garantia total de satisfação
✅ Suporte dedicado
✅ Acesso imediato após o pagamento

Se não for agora, tudo bem. Mas se for... o link está aqui:
{{link_checkout}}

Sucesso! 🚀`,
        delay_minutes: 1440, // 24 horas
      },
    ],
  },

  // =====================================================
  // PURCHASE APPROVED - Boas-vindas
  // =====================================================
  {
    name: "Compra Aprovada - Boas-Vindas",
    event_type: "purchase_approved",
    description: "Mensagem de boas-vindas após compra aprovada",
    messages: [
      {
        content: `🎉 PARABÉNS {{nome}}! 🎉

Sua compra do *{{produto}}* foi APROVADA!

Você acabou de dar um passo incrível rumo aos seus objetivos. Estou muito feliz em ter você conosco!

📧 Em breve você receberá um email com todos os detalhes de acesso.

Qualquer dúvida, estou aqui para ajudar!

Seja muito bem-vindo(a)! 🚀✨`,
        delay_minutes: 0,
      },
    ],
  },

  // =====================================================
  // PURCHASE REFUSED - Alternativa de pagamento
  // =====================================================
  {
    name: "Compra Recusada - Alternativa",
    event_type: "purchase_refused",
    description: "Mensagem amigável com alternativa de pagamento",
    messages: [
      {
        content: `{{nome}}, tudo bem? 

Notei que houve um probleminha com o pagamento do *{{produto}}*.

Não se preocupe, isso acontece! 😊

Pode ter sido:
• Limite do cartão
• Dados incorretos
• Problema temporário do banco

A boa notícia é que você pode tentar novamente ou escolher outra forma de pagamento:

{{link_checkout}}

Se preferir, posso gerar um PIX ou boleto para você. É só me avisar!

Estou aqui para ajudar! 🤝`,
        delay_minutes: 5,
      },
    ],
  },
]

/**
 * Retorna fluxo padrão por tipo de evento
 */
export function getDefaultFlowByEvent(eventType: CaktoEventType): DefaultFlow | undefined {
  return DEFAULT_FLOWS.find((flow) => flow.event_type === eventType)
}

/**
 * Lista todos os tipos de eventos suportados
 */
export const SUPPORTED_EVENTS: CaktoEventType[] = [
  "boleto_gerado",
  "pix_gerado",
  "picpay_gerado",
  "openfinance_nubank_gerado",
  "checkout_abandonment",
  "purchase_approved",
  "purchase_refused",
]

/**
 * Labels amigáveis para os eventos
 */
export const EVENT_LABELS: Record<CaktoEventType, string> = {
  boleto_gerado: "Boleto Gerado",
  pix_gerado: "PIX Gerado",
  picpay_gerado: "PicPay Gerado",
  openfinance_nubank_gerado: "Nubank OpenFinance",
  checkout_abandonment: "Carrinho Abandonado",
  purchase_approved: "Compra Aprovada",
  purchase_refused: "Compra Recusada",
}

/**
 * Cores para os eventos (para UI)
 */
export const EVENT_COLORS: Record<CaktoEventType, string> = {
  boleto_gerado: "bg-amber-500",
  pix_gerado: "bg-green-500",
  picpay_gerado: "bg-purple-500",
  openfinance_nubank_gerado: "bg-violet-500",
  checkout_abandonment: "bg-red-500",
  purchase_approved: "bg-emerald-500",
  purchase_refused: "bg-rose-500",
}

// =====================================================
// KIRVANO CONSTANTS
// =====================================================

/**
 * Lista todos os tipos de eventos Kirvano suportados
 */
export const KIRVANO_SUPPORTED_EVENTS: KirvanoEventType[] = [
  "bank_slip_generated",
  "pix_generated",
  "credit_card_generated",
  "sale_approved",
  "sale_refunded",
  "sale_cancelled",
  "checkout_abandoned",
]

/**
 * Labels amigáveis para os eventos Kirvano
 */
export const KIRVANO_EVENT_LABELS: Record<KirvanoEventType, string> = {
  bank_slip_generated: "Boleto Gerado",
  pix_generated: "PIX Gerado",
  credit_card_generated: "Cartão de Crédito Gerado",
  sale_approved: "Venda Aprovada",
  sale_refunded: "Venda Reembolsada",
  sale_cancelled: "Venda Cancelada",
  checkout_abandoned: "Checkout Abandonado",
}

/**
 * Cores para os eventos Kirvano (para UI)
 */
export const KIRVANO_EVENT_COLORS: Record<KirvanoEventType, string> = {
  bank_slip_generated: "bg-amber-500",
  pix_generated: "bg-green-500",
  credit_card_generated: "bg-blue-500",
  sale_approved: "bg-emerald-500",
  sale_refunded: "bg-orange-500",
  sale_cancelled: "bg-rose-500",
  checkout_abandoned: "bg-red-500",
}

/**
 * Mapeamento de eventos Kirvano para eventos Cakto (para reutilizar fluxos)
 * 
 * Este mapeamento permite que webhooks Kirvano reutilizem os fluxos de mensagens existentes
 * criados para eventos Cakto. As seguintes escolhas de mapeamento foram feitas:
 * 
 * - bank_slip_generated → boleto_gerado: Mapeamento direto (mesmo conceito)
 * - pix_generated → pix_gerado: Mapeamento direto (mesmo conceito)
 * - credit_card_generated → purchase_approved: Geralmente cartão de crédito significa aprovação imediata
 * - sale_approved → purchase_approved: Mapeamento direto (mesmo conceito)
 * - sale_refunded → purchase_refused: Mapeamento aproximado. Embora reembolso não seja o mesmo que
 *   recusa, ambos resultam em uma venda não completada. Fluxos específicos para reembolso podem
 *   ser criados futuramente se necessário.
 * - sale_cancelled → purchase_refused: Cancelamento é tratado como recusa
 * - checkout_abandoned → checkout_abandonment: Mapeamento direto (mesmo conceito)
 */
export const KIRVANO_TO_CAKTO_EVENT_MAP: Record<KirvanoEventType, CaktoEventType> = {
  bank_slip_generated: "boleto_gerado",
  pix_generated: "pix_gerado",
  credit_card_generated: "purchase_approved",
  sale_approved: "purchase_approved",
  sale_refunded: "purchase_refused",
  sale_cancelled: "purchase_refused",
  checkout_abandoned: "checkout_abandonment",
}
