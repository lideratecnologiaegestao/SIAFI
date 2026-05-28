'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, CreditCard, MessageCircle, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/portal',         icon: Home,          label: 'Início'     },
  { href: '/portal/contratos', icon: FileText,    label: 'Contratos'  },
  { href: '/portal/pagamentos', icon: CreditCard, label: 'Pagamentos' },
  { href: '/portal/suporte',  icon: MessageCircle, label: 'Suporte'   },
  { href: '/portal/perfil',   icon: User,          label: 'Perfil'    },
]

interface BottomNavProps {
  ticketsBadge?: number
}

export function PortalBottomNav({ ticketsBadge = 0 }: BottomNavProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/portal') return pathname === '/portal'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile — bottom fixed */}
      <nav
        className="portal-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: 'var(--portal-white)',
          borderTop: '1px solid var(--portal-gray-100)',
          display: 'flex',
          zIndex: 50,
          boxShadow: '0 -4px 16px rgba(0,0,0,.06)',
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          const isSuporte = href === '/portal/suporte'
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                color: active ? 'var(--portal-blue-600)' : 'var(--portal-gray-600)',
                textDecoration: 'none',
                position: 'relative',
                minHeight: '44px',
                transition: 'color 150ms ease',
              }}
            >
              {/* Badge de chamados não lidos */}
              {isSuporte && ticketsBadge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: 'calc(50% - 18px)',
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
                    padding: '0 4px',
                  }}
                >
                  {ticketsBadge > 9 ? '9+' : ticketsBadge}
                </span>
              )}

              {/* Indicador da aba ativa */}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '24px',
                    height: '2px',
                    borderRadius: '0 0 2px 2px',
                    background: 'var(--portal-blue-600)',
                  }}
                />
              )}

              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: active ? 600 : 400,
                  fontFamily: 'var(--font-dm-sans, sans-serif)',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

    </>
  )
}
