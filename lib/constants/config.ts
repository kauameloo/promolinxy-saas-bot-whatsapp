// =====================================================
// CONFIG - Configurações do sistema
// =====================================================

/**
 * Default tenant ID for single-tenant mode
 * In production SaaS mode, this would be extracted from the user's JWT token
 * or request headers
 */
export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001"
