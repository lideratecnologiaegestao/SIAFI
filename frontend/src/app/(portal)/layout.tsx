'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, LogOut, User, Bell } from 'lucide-react'
import { PortalAuthProvider, usePortalAuth } from '@/contexts/portal-auth.context'
import { Button } from '@/components/ui/button'
import { useRealtimePortal } from '@/hooks/portal/use-realtime-portal'

function PortalLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = usePortalAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  const { notificacoes } = useRealtimePortal(user?.id)
  const badgeCount = notificacoes.length

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/portal/login?redirect=' + encodeURIComponent(pathname))
    }
  }, [isAuthenticated, isLoading, router, pathname])

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.primeiroAcesso && pathname !== '/portal/primeiro-acesso') {
      router.replace('/portal/primeiro-acesso?redirect=' + encodeURIComponent(pathname))
    }
  }, [isLoading, isAuthenticated, user?.primeiroAcesso, pathname, router])

  async function handleLogout() {
    setLoggingOut(true)
    try { await logout() } catch {}
    router.replace('/portal/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/portal" className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-blue-700 leading-none">SIAFI</span>
            <span className="text-xs text-muted-foreground leading-none mt-0.5 hidden sm:block">
              Olá, {user.nome.split(' ')[0]}
            </span>
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
              disabled={loggingOut}
              aria-label="Sair"
            >
              {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-border bg-white py-4">
        <p className="text-center text-xs text-muted-foreground">
          SIAFI — Sistema Integrado de Apoio Financeiro · Lidera &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalAuthProvider>
      <PortalLayoutContent>{children}</PortalLayoutContent>
    </PortalAuthProvider>
  )
}
