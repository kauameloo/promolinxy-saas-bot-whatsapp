// =====================================================
// USE API - Hook para chamadas de API
// =====================================================

"use client"

import useSWR, { type SWRConfiguration } from "swr"
import { useAuth } from "./use-auth"
import { getApiUrl } from "@/lib/utils/api-url"

const fetcher = async (url: string, token?: string | null) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const fullUrl = getApiUrl(url)
  const response = await fetch(fullUrl, { headers })
  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || "Erro na requisição")
  }

  return data.data
}

export function useApi<T>(url: string | null, config?: SWRConfiguration) {
  const { token } = useAuth()

  return useSWR<T>(url ? [url, token] : null, ([url, token]) => fetcher(url, token), {
    revalidateOnFocus: false,
    ...config,
  })
}

export async function apiPost<T>(url: string, body: unknown, token?: string | null): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const fullUrl = getApiUrl(url)
  const response = await fetch(fullUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || "Erro na requisição")
  }

  return data.data
}

export async function apiPut<T>(url: string, body: unknown, token?: string | null): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const fullUrl = getApiUrl(url)
  const response = await fetch(fullUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || "Erro na requisição")
  }

  return data.data
}

export async function apiDelete(url: string, token?: string | null): Promise<void> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const fullUrl = getApiUrl(url)
  const response = await fetch(fullUrl, {
    method: "DELETE",
    headers,
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || "Erro na requisição")
  }
}
