// =====================================================
// API URL - Utility for constructing API URLs
// =====================================================

/**
 * Get the base API URL from environment variable or default to current origin
 * In development: defaults to http://localhost:3000
 * In production: uses NEXT_PUBLIC_API_URL or current origin
 */
export function getApiBaseUrl(): string {
  // Use NEXT_PUBLIC_API_URL if set, otherwise default to current origin
  // This allows the frontend to call a different backend API server
  if (typeof window !== "undefined") {
    // Client-side: use environment variable or current origin
    return process.env.NEXT_PUBLIC_API_URL || window.location.origin
  }
  // Server-side: use environment variable or empty string (will be relative)
  return process.env.NEXT_PUBLIC_API_URL || ""
}

/**
 * Construct full API URL from a path
 * @param path - API path (e.g., "/api/auth/login" or "api/auth/login")
 * @returns Full API URL
 */
export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  
  // If baseUrl is empty (server-side without env var), return just the path
  if (!baseUrl) {
    return normalizedPath
  }
  
  return `${baseUrl}${normalizedPath}`
}
