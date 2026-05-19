'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, Receipt, Wallet,
  ArrowLeftRight, Settings, Shield, LogOut, X, ChevronRight,
  AlertCircle, RefreshCcw, QrCode, BarChart2, Bell, MessageSquare,
  UserCog, ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth.context'
import { Button } from '@/components/ui/button'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles?: string[]
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Operacional',
    items: [
      { label: 'Clientes', href: '/clientes', icon: Users, roles: ['admin', 'financeiro', 'caixa'] },
      { label: 'Empréstimos', href: '/emprestimos', icon: CreditCard, roles: ['admin', 'financeiro'] },
      { label: 'Parcelas', href: '/parcelas', icon: Receipt, roles: ['admin', 'financeiro', 'caixa'] },
      { label: 'Pagamentos', href: '/pagamentos', icon: Wallet, roles: ['admin', 'financeiro', 'caixa'] },
      { label: 'Inadimplentes', href: '/inadimplentes', icon: AlertCircle, roles: ['admin', 'financeiro'] },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Caixa', href: '/caixa', icon: ArrowLeftRight, roles: ['admin', 'financeiro', 'caixa'] },
      { label: 'Renegociações', href: '/renegociacoes', icon: RefreshCcw, roles: ['admin', 'financeiro'] },
      { label: 'Conciliação', href: '/conciliacao', icon: ListChecks, roles: ['admin', 'financeiro'] },
      { label: 'PIX', href: '/pix', icon: QrCode, roles: ['admin', 'financeiro'] },
    ],
  },
  {
    title: 'Relatórios',
    items: [
      { label: 'Relatórios', href: '/relatorios', icon: BarChart2, roles: ['admin', 'financeiro'] },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { label: 'Notificações', href: '/notificacoes', icon: Bell, roles: ['admin', 'financeiro'] },
      { label: 'Suporte', href: '/suporte', icon: MessageSquare, roles: ['admin', 'financeiro', 'caixa'] },
    ],
  },
  {
    title: 'Administração',
    items: [
      { label: 'Usuários', href: '/usuarios', icon: UserCog, roles: ['admin'] },
      { label: 'Configurações', href: '/configuracoes', icon: Settings, roles: ['admin'] },
      { label: 'Auditoria', href: '/auditoria', icon: Shield, roles: ['admin'] },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || (user && item.roles.includes(user.role))
    ),
  })).filter((group) => group.items.length > 0)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  function getInitials(nome: string) {
    return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  }

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    financeiro: 'Financeiro',
    caixa: 'Caixa',
    usuario: 'Usuário',
    cliente: 'Cliente',
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col transition-transform duration-300 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: '#0f172a' }}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-wide">SIAFI</p>
              <p className="text-slate-400 text-[10px]">Apoio Financeiro</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.title}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
                    )}
                  >
                    <Icon className="size-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight className="size-3 opacity-60" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-xs font-semibold">
                {user ? getInitials(user.nome) : '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.nome ?? 'Usuário'}</p>
              <p className="text-xs text-slate-500">{user ? (roleLabel[user.role] ?? user.role) : ''}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/8 gap-2"
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>
    </>
  )
}
