'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Loader2, LogOut, User, Bell } from 'lucide-react'
import { useAuth } from '@/contexts/auth.context'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { portalApi } from '@/lib/portal/portal-api'
import { useRealtimePortal } from '@/hooks/portal/use-realtime-portal'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const { data: perfil } = useQuery({
    queryKey: ['portal-perfil-layout'],
    queryFn: portalApi.getPerfil,
    enabled: !!user && user.role === 'cliente',
  })

  const { notificacoes } = useRealtimePortal(user?.id)
  const badgeCount = notificacoes.length

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
      return
    }
    if (!isLoading && user && user.role !== 'cliente') {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, isLoading, user, router])

  // Redirect to primeiro-acesso page if needed (but not if already there)
  useEffect(() => {
    if (perfil?.primeiroAcesso && pathname !== '/portal/primeiro-acesso') {
      router.replace('/portal/primeiro-acesso')
    }
  }, [perfil?.primeiroAcesso, pathname, router])

  async function handleLogout() {
    try { await logout() } catch {}
    try { await getSupabaseBrowserClient().auth.signOut() } catch {}
    router.replace('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated || !user || user.role !== 'cliente') return null

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/portal" className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-blue-700 leading-none">SIAFI</span>
            {perfil && (
              <span className="text-xs text-muted-foreground leading-none mt-0.5 hidden sm:block">
                Olá, {perfil.nome.split(' ')[0]}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-1">
            {badgeCount > 0 && (
              <div className="relative">
                <Bell className="size-5 text-muted-foreground" />
                <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              </div>
            )}
            <Link href="/portal/perfil">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Meu perfil">
                <User className="size-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleLogout}
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-4">
        <p className="text-center text-xs text-muted-foreground">
          SIAFI — Sistema Integrado de Apoio Financeiro · Lidera &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
