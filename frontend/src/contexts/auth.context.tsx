'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import api, { tokenStore } from '@/lib/api'

export type UserRole = 'admin' | 'financeiro' | 'caixa' | 'usuario' | 'cliente'

export interface AuthUser {
  id: number
  username: string
  nome: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: { username: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/auth/me')
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const me = await fetchMe()
        if (!cancelled) setUser(me)
      } catch {
        try {
          const { data } = await api.post<{ accessToken: string }>('/auth/refresh')
          tokenStore.set(data.accessToken)
          const me = await fetchMe()
          if (!cancelled) setUser(me)
        } catch {
          if (!cancelled) setUser(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  async function login(credentials: { username: string; password: string }) {
    const { data } = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', credentials)
    tokenStore.set(data.accessToken)
    setUser(data.user)
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      tokenStore.clear()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
