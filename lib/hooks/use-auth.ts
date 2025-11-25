// =====================================================
// USE AUTH - Hook de autenticação
// =====================================================

"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User } from "@/lib/types"

interface AuthState {
  user: Omit<User, "password_hash"> | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,

      login: async (email: string, password: string) => {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Erro ao fazer login")
        }

        set({
          user: data.data.user,
          token: data.data.token,
          isLoading: false,
        })
      },

      logout: () => {
        set({ user: null, token: null, isLoading: false })
      },

      checkAuth: async () => {
        const { token } = get()

        if (!token) {
          set({ isLoading: false })
          return
        }

        try {
          const response = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          })

          const data = await response.json()

          if (data.success) {
            set({ user: data.data, isLoading: false })
          } else {
            set({ user: null, token: null, isLoading: false })
          }
        } catch {
          set({ user: null, token: null, isLoading: false })
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }),
    },
  ),
)
