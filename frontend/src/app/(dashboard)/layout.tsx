'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { useAuth, type UserRole } from '@/contexts/auth.context'
import { Loader2 } from 'lucide-react'

// Prefixes that require a minimum role set. First match wins.
const ROUTE_ROLES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/usuarios', roles: ['admin'] },
  { prefix: '/configuracoes', roles: ['admin'] },
  { prefix: '/auditoria', roles: ['admin'] },
  { prefix: '/emprestimos', roles: ['admin', 'financeiro'] },
  { prefix: '/relatorios', roles: ['admin', 'financeiro'] },
  { prefix: '/renegociacoes', roles: ['admin', 'financeiro'] },
  { prefix: '/pix', roles: ['admin', 'financeiro'] },
  { prefix: '/conciliacao', roles: ['admin', 'financeiro'] },
  { prefix: '/inadimplentes', roles: ['admin', 'financeiro'] },
  { prefix: '/notificacoes', roles: ['admin', 'financeiro'] },
  { prefix: '/consultor', roles: ['consultor'] },
  { prefix: '/solicitacoes', roles: ['admin', 'financeiro', 'consultor'] },
  { prefix: '/intencoes', roles: ['admin', 'financeiro', 'consultor'] },
  { prefix: '/cobrancas', roles: ['admin', 'financeiro', 'consultor'] },
]

function isAllowed(pathname: string, role: UserRole): boolean {
  const match = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix))
  if (!match) return true
  return (match.roles as string[]).includes(role)
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
      return
    }
    if (!isLoading && user?.role === 'cliente') {
      router.replace('/portal')
      return
    }
    if (!isLoading && user && pathname && !isAllowed(pathname, user.role)) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, isLoading, user, pathname, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
