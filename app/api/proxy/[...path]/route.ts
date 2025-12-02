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

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
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

    let body: string | undefined
    try {
      body = JSON.stringify(await request.json())
    } catch {
      // No body or invalid JSON
      body = undefined
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getForwardHeaders(request),
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
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

    let body: string | undefined
    try {
      body = JSON.stringify(await request.json())
    } catch {
      body = undefined
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...getForwardHeaders(request),
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
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

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
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
