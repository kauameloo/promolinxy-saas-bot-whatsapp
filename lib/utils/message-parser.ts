// =====================================================
// MESSAGE PARSER - Substituição de variáveis
// =====================================================

import type { MessageVariables } from "@/lib/types"

/**
 * Substitui placeholders {{variavel}} pelo valor correspondente
 */
export function parseMessage(template: string, variables: MessageVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key]
    return value !== undefined ? value : match
  })
}

/**
 * Extrai todas as variáveis de um template
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }

  return variables
}

/**
 * Valida se todas as variáveis estão preenchidas
 */
export function validateVariables(
  template: string,
  variables: MessageVariables,
): { valid: boolean; missing: string[] } {
  const required = extractVariables(template)
  const missing = required.filter((v) => variables[v] === undefined || variables[v] === "")

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Formata número de telefone para o padrão WhatsApp
 */
export function formatPhoneNumber(phone: string): string {
  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, "")

  // Remove o 0 inicial se existir
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1)
  }

  // Adiciona código do Brasil se não tiver
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned
  }

  // Adiciona @c.us para WhatsApp
  return cleaned + "@c.us"
}

/**
 * Formata valor monetário
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

/**
 * Formata data para exibição no horário do Brasil
 */
export function formatDate(date: Date | string, timezone = "America/Sao_Paulo"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(d)
}

/**
 * Extrai código PIX do payload (aceita pix_code ou pix_qrcode)
 */
export function getPixCode(payment?: { pix_code?: string; pix_qrcode?: string }): string | undefined {
  return payment?.pix_code || payment?.pix_qrcode
}
