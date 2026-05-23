'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import api, { tokenStore } from '@/lib/api'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'financeiro' | 'consultor' | 'caixa' | 'cliente'

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
  login: (credentials: { identificador: string; password: string }) => Promise<{ needsMfa?: boolean; setupMfaRequired?: boolean; role?: UserRole }>
  loginWithGoogle: () => Promise<void>
  completeMfa: (aal2Token: string) => Promise<void>
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
    tokenStore.onAuthLost = () => { setUser(null) }
    return () => { tokenStore.onAuthLost = null }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const supabase = getSupabaseBrowserClient()

      // 0. Handle OAuth callback code in URL (any page, any port)
      const urlCode = new URLSearchParams(window.location.search).get('code')
      if (urlCode) {
        window.history.replaceState({}, '', window.location.pathname)
        const { data: exchangeData } = await supabase.auth.exchangeCodeForSession(urlCode)
        if (exchangeData.session?.access_token) {
          tokenStore.set(exchangeData.session.access_token)
          try {
            const me = await fetchMe()
            if (!cancelled) {
              setUser(me)
              setIsLoading(false)
              window.location.replace('/dashboard')
            }
          } catch {
            await supabase.auth.signOut()
            tokenStore.clear()
            if (!cancelled) window.location.replace('/login?error=acesso_negado')
          }
          return
        }
      }

      // 1. Try existing in-memory token
      try {
        const me = await fetchMe()
        if (!cancelled) { setUser(me); return }
      } catch {}

      // 2. Try NestJS refresh via httpOnly cookie
      try {
        const { data } = await api.post<{ accessToken: string }>('/auth/refresh')
        tokenStore.set(data.accessToken)
        const me = await fetchMe()
        if (!cancelled) { setUser(me); return }
      } catch {}

      // 3. Check Supabase session (Google OAuth staff only — NEVER client sessions)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          // Decode JWT to reject client sessions — prevents a client Supabase session
          // stored in a staff browser from silently authenticating as the wrong user
          const parts = session.access_token.split('.')
          const payload = parts[1]
            ? JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
            : {}
          const appRole = (payload?.app_metadata as Record<string, unknown> | undefined)?.role
          if (appRole !== 'cliente') {
            tokenStore.set(session.access_token)
            const me = await fetchMe()
            if (!cancelled) setUser(me)
          }
        }
      } catch {}
    }

    init().finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [])

  async function login(credentials: { identificador: string; password: string }) {
    const { data } = await api.post<{
      accessToken: string
      user: AuthUser
      needsMfa?: boolean
      setupMfaRequired?: boolean
    }>('/auth/login', credentials)

    tokenStore.set(data.accessToken)

    if (data.needsMfa) {
      return { needsMfa: true }
    }

    if (data.setupMfaRequired) {
      setUser(data.user)
      return { setupMfaRequired: true }
    }

    setUser(data.user)
    return { role: data.user.role }
  }

  async function completeMfa(aal2Token: string) {
    tokenStore.set(aal2Token)
    const me = await fetchMe()
    setUser(me)
  }

  async function loginWithGoogle() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function logout() {
    try { await api.post('/auth/logout') } catch {}
    try {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.signOut()
    } catch {}
    tokenStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, loginWithGoogle, completeMfa, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}
