'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { portalClient, portalTokenStore } from '@/lib/portal/portal-client'
import type { PortalPerfil } from '@/lib/portal/portal-types'

interface PortalAuthContextValue {
  user: PortalPerfil | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null)

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext)
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider')
  return ctx
}

function isClientToken(token: string): boolean {
  try {
    const b64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!b64) return false
    const payload = JSON.parse(atob(b64))
    return (payload?.app_metadata as any)?.role === 'cliente'
  } catch {
    return false
  }
}

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PortalPerfil | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    portalTokenStore.onAuthLost = () => setUser(null)
    return () => { portalTokenStore.onAuthLost = null }
  }, [])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let cancelled = false

    async function loadFromToken(token: string) {
      portalTokenStore.set(token)
      try {
        const { data } = await portalClient.get<PortalPerfil>('/portal/perfil')
        if (!cancelled) setUser(data)
      } catch {
        portalTokenStore.clear()
        if (!cancelled) setUser(null)
      }
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token && isClientToken(session.access_token)) {
        await loadFromToken(session.access_token)
      } else if (!cancelled) {
        setUser(null)
      }
    }

    init().finally(() => { if (!cancelled) setIsLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (event === 'SIGNED_OUT') {
        portalTokenStore.clear()
        if (!cancelled) setUser(null)
      } else if (session?.access_token && isClientToken(session.access_token)) {
        await loadFromToken(session.access_token)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut().catch(() => {})
    portalTokenStore.clear()
    setUser(null)
  }

  async function refreshUser() {
    try {
      const { data } = await portalClient.get<PortalPerfil>('/portal/perfil')
      setUser(data)
    } catch {}
  }

  return (
    <PortalAuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, logout, refreshUser }}>
      {children}
    </PortalAuthContext.Provider>
  )
}
