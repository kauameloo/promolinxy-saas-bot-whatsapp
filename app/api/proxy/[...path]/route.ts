// =====================================================
// PROXY API - Routes requests to WhatsApp Engine Backend
// =====================================================
// This proxy allows the frontend (deployed on Vercel HTTPS) to communicate
// with the backend (deployed on VPS via HTTP) without mixed content issues.
// All requests to /api/proxy/* are forwarded to the WHATSAPP_ENGINE_URL.

import { type NextRequest, NextResponse } from "next/server"

// Backend URL - defaults to localhost for development
const BACKEND_URL = process.env.WHATSAPP_ENGINE_URL || "http://localhost:3001"

// Timeout for backend requests (30 seconds)
const REQUEST_TIMEOUT_MS = 30000

/**
 * Forward headers from the original request to the backend.
 * Filter out headers that should not be forwarded.
 */
function getForwardHeaders(request: NextRequest): HeadersInit {
  const headers: HeadersInit = {}
  const skipHeaders = new Set([
    "host",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "proxy-authorization",
    "proxy-authenticate",
  ])

  request.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) {
      headers[key] = value
    }
  })

  return headers
}

/**
 * Parse the response based on content type
 */
async function parseResponse(response: Response): Promise<NextResponse> {
  const contentType = response.headers.get("content-type") || ""
  
  // Handle JSON responses
  if (contentType.includes("application/json")) {
    try {
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    } catch {
      // If JSON parsing fails, return empty response with status
      return new NextResponse(null, { status: response.status })
    }
  }
  
  // Handle text responses
  if (contentType.includes("text/")) {
    const text = await response.text()
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": contentType },
    })
  }
  
  // Handle empty responses (204 No Content, etc.)
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return new NextResponse(null, { status: response.status })
  }
  
  // For other content types, try to return as JSON (most common case for this API)
  try {
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    // Fallback: return the response body as-is
    const body = await response.arrayBuffer()
    return new NextResponse(body, {
      status: response.status,
      headers: contentType ? { "Content-Type": contentType } : undefined,
    })
  }
}

/**
 * Get request body and headers for methods that send data
 */
async function getRequestBodyAndHeaders(
  request: NextRequest
): Promise<{ body: string | undefined; headers: HeadersInit }> {
  const forwardHeaders = getForwardHeaders(request)
  const requestContentType = request.headers.get("content-type") || ""
  
  // Only try to parse JSON if content-type indicates JSON
  if (requestContentType.includes("application/json")) {
    try {
      const body = JSON.stringify(await request.json())
      return {
        body,
        headers: { ...forwardHeaders, "Content-Type": "application/json" },
      }
    } catch {
      // JSON parsing failed, log warning
      console.warn("[Proxy] Failed to parse request JSON body")
      return { body: undefined, headers: forwardHeaders }
    }
  }
  
  // For other content types or no body
  return { body: undefined, headers: forwardHeaders }
}

/**
 * Handle GET requests
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params
  const pathString = path.join("/")
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${BACKEND_URL}/${pathString}${searchParams ? `?${searchParams}` : ""}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(url, {
      method: "GET",
      headers: getForwardHeaders(request),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return parseResponse(response)
  } catch (error) {
    console.error(`[Proxy] GET ${url} error:`, error)
    return handleProxyError(error)
  }
}

/**
 * Handle POST requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params
  const pathString = path.join("/")
  const url = `${BACKEND_URL}/${pathString}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const { body, headers } = await getRequestBodyAndHeaders(request)

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return parseResponse(response)
  } catch (error) {
    console.error(`[Proxy] POST ${url} error:`, error)
    return handleProxyError(error)
  }
}

/**
 * Handle PUT requests
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params
  const pathString = path.join("/")
  const url = `${BACKEND_URL}/${pathString}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const { body, headers } = await getRequestBodyAndHeaders(request)

    const response = await fetch(url, {
      method: "PUT",
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return parseResponse(response)
  } catch (error) {
    console.error(`[Proxy] PUT ${url} error:`, error)
    return handleProxyError(error)
  }
}

/**
 * Handle DELETE requests
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params
  const pathString = path.join("/")
  const url = `${BACKEND_URL}/${pathString}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(url, {
      method: "DELETE",
      headers: getForwardHeaders(request),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return parseResponse(response)
  } catch (error) {
    console.error(`[Proxy] DELETE ${url} error:`, error)
    return handleProxyError(error)
  }
}

/**
 * Handle proxy errors consistently
 */
function handleProxyError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return NextResponse.json(
        { success: false, error: "Tempo limite excedido ao conectar com o servidor backend." },
        { status: 504 }
      )
    }
    if (error.message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { success: false, error: "Servidor backend não está disponível. Verifique se está rodando." },
        { status: 503 }
      )
    }
  }
  return NextResponse.json(
    { success: false, error: "Erro ao conectar com o servidor backend." },
    { status: 502 }
  )
}
