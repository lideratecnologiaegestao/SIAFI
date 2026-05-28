'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Bell, LogOut } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth.context'
import { useRealtimePortal } from '@/hooks/portal/use-realtime-portal'
import { PortalBottomNav } from '@/components/portal/bottom-nav'

export function PortalLayoutContent({ children }: { children: React.ReactNode }) {
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
    if (!isLoading && isAuthenticated && user?.primeiroAcesso && pathname !== '/portal/termos-aceite') {
      router.replace('/portal/termos-aceite')
    }
  }, [isLoading, isAuthenticated, user?.primeiroAcesso, pathname, router])

  async function handleLogout() {
    setLoggingOut(true)
    try { await logout() } catch {}
    router.replace('/portal/login')
  }

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--portal-gray-100)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--portal-blue-100)',
              borderTopColor: 'var(--portal-blue-600)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Carregando...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) return null

  const primeiroNome = user.nome.split(' ')[0]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--portal-gray-100)', display: 'flex', flexDirection: 'column' }}>
      {/* Header sticky */}
      <header
        className="portal-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--portal-white)',
          borderBottom: '1px solid var(--portal-gray-100)',
          boxShadow: '0 1px 8px rgba(0,0,0,.05)',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            padding: '0 16px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo + saudação */}
          <Link href="/portal" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--portal-blue-600)',
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-dm-sans, sans-serif)',
            }}>
              SIAFI
            </span>
            <span style={{
              fontSize: '12px',
              color: 'var(--portal-gray-600)',
              fontFamily: 'var(--font-dm-sans, sans-serif)',
            }}>
              Olá, {primeiroNome}!
            </span>
          </Link>

          {/* Ações direita */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Badge de notificações */}
            {badgeCount > 0 && (
              <Link
                href="/portal/suporte"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  color: 'var(--portal-gray-600)',
                  textDecoration: 'none',
                }}
                aria-label={`${badgeCount} notificação(ões)`}
              >
                <Bell size={20} />
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '999px',
                    background: 'var(--portal-red-600)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                  }}
                >
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              </Link>
            )}

            {/* Sair */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sair"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--portal-gray-600)',
                cursor: loggingOut ? 'not-allowed' : 'pointer',
              }}
            >
              {loggingOut
                ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <LogOut size={18} />
              }
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main style={{ flex: 1, maxWidth: '640px', width: '100%', margin: '0 auto', padding: '20px 16px 84px' }}>
        {children}
      </main>

      {/* Bottom navigation */}
      <PortalBottomNav ticketsBadge={badgeCount} />
    </div>
  )
}
