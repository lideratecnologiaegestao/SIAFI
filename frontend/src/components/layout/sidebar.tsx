'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, Receipt, Wallet,
  ArrowLeftRight, Settings, Shield, LogOut, X, ChevronRight,
  AlertCircle, RefreshCcw, QrCode, BarChart2, Bell, MessageSquare,
  UserCog, ListChecks, Briefcase, ClipboardList, TrendingUp, Phone,
  Banknote, Search, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth.context'
import { Button } from '@/components/ui/button'
import { useUnreadCount } from '@/hooks/useUnreadCount'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles?: string[]
  badge?: 'unread'
}

interface NavGroup {
  title: string
  roles?: string[]
  items: NavItem[]
}

// ─── Grupos por perfil ───────────────────────────────────────────────────────

const navGroups: NavGroup[] = [
  // ── Principal (todos os perfis autenticados) ──────────────────────────────
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },

  // ── Fila de Trabalho (financeiro / admin) ─────────────────────────────────
  {
    title: 'Fila de Trabalho',
    roles: ['admin', 'financeiro'],
    items: [
      { label: 'Intenções',            href: '/intencoes',            icon: TrendingUp },
      { label: 'Liberações Pendentes', href: '/liberacoes-pendentes', icon: Banknote },
      { label: 'Reparcelamentos',      href: '/reparcelamentos',      icon: RefreshCcw },
    ],
  },

  // ── Operacional (financeiro / admin) ──────────────────────────────────────
  {
    title: 'Operacional',
    roles: ['admin', 'financeiro'],
    items: [
      { label: 'Clientes',      href: '/clientes',      icon: Users },
      { label: 'Empréstimos',   href: '/emprestimos',   icon: CreditCard },
      { label: 'Parcelas',      href: '/parcelas',      icon: Receipt },
      { label: 'Pagamentos',    href: '/pagamentos',    icon: Wallet },
      { label: 'Inadimplentes', href: '/inadimplentes', icon: AlertCircle },
    ],
  },

  // ── Financeiro (financeiro / admin) ───────────────────────────────────────
  {
    title: 'Financeiro',
    roles: ['admin', 'financeiro'],
    items: [
      { label: 'Caixa',         href: '/caixa',         icon: ArrowLeftRight },
      { label: 'Renegociações', href: '/renegociacoes', icon: RefreshCcw },
      { label: 'Conciliação',   href: '/conciliacao',   icon: ListChecks },
      { label: 'PIX',           href: '/pix',           icon: QrCode },
    ],
  },

  // ── Relatórios e Comunicação (financeiro / admin) ─────────────────────────
  {
    title: 'Relatórios',
    roles: ['admin', 'financeiro'],
    items: [
      { label: 'Relatórios',   href: '/relatorios',   icon: BarChart2 },
      { label: 'Notificações', href: '/notificacoes', icon: Bell },
    ],
  },

  // ── Minha Carteira (consultor) ────────────────────────────────────────────
  {
    title: 'Minha Carteira',
    roles: ['consultor'],
    items: [
      { label: 'Clientes',   href: '/clientes',   icon: Users },
      { label: 'Intenções',  href: '/intencoes',  icon: TrendingUp },
      { label: 'Solicitações', href: '/solicitacoes', icon: ClipboardList },
      { label: 'Cobranças',  href: '/cobrancas',  icon: Phone },
    ],
  },

  // ── Ferramentas do Consultor ───────────────────────────────────────────────
  {
    title: 'Ferramentas',
    roles: ['consultor'],
    items: [
      { label: 'PIX / Boleto',       href: '/pix',                   icon: QrCode },
      { label: 'Reparcelamentos',    href: '/reparcelamentos',        icon: RefreshCcw },
      { label: 'Relatórios',         href: '/consultor/relatorios',  icon: BarChart2 },
    ],
  },

  // ── Operações do Caixa ────────────────────────────────────────────────────
  {
    title: 'Operações',
    roles: ['caixa'],
    items: [
      { label: 'Liberar Capital',     href: '/liberacoes-pendentes', icon: Banknote },
      { label: 'Registrar Pagamento', href: '/pagamentos/novo',      icon: Wallet },
      { label: 'Parcelas do Dia',     href: '/parcelas',             icon: Receipt },
    ],
  },

  // ── Consulta (caixa) ──────────────────────────────────────────────────────
  {
    title: 'Consulta',
    roles: ['caixa'],
    items: [
      { label: 'Consultar Cliente', href: '/clientes', icon: Search },
    ],
  },

  // ── Caixa (caixa) ─────────────────────────────────────────────────────────
  {
    title: 'Caixa',
    roles: ['caixa'],
    items: [
      { label: 'Saldo e Movimentações', href: '/caixa', icon: ArrowLeftRight },
    ],
  },

  // ── Administração (financeiro aparece em Solicitações; admin vê tudo) ─────
  {
    title: 'Atendimento',
    roles: ['admin', 'financeiro'],
    items: [
      { label: 'Solicitações', href: '/solicitacoes', icon: ClipboardList },
      { label: 'Cobranças',    href: '/cobrancas',    icon: Phone },
      { label: 'Suporte',      href: '/suporte',      icon: MessageSquare },
    ],
  },

  // ── Comunicação (todos exceto cliente) ────────────────────────────────────
  {
    title: 'Comunicação',
    items: [
      {
        label: 'Mensagens',
        href: '/mensagens',
        icon: MessageSquare,
        badge: 'unread',
      },
    ],
  },

  // ── Comunicação Caixa (suporte) ───────────────────────────────────────────
  {
    title: 'Suporte',
    roles: ['caixa'],
    items: [
      { label: 'Suporte', href: '/suporte', icon: MessageSquare },
    ],
  },

  // ── Administração (admin only) ────────────────────────────────────────────
  {
    title: 'Administração',
    roles: ['admin'],
    items: [
      { label: 'Usuários',           href: '/usuarios',               icon: UserCog },
      { label: 'Configurações',      href: '/configuracoes',          icon: Settings },
      { label: 'Templates de Email', href: '/configuracoes/emails',   icon: Mail },
      { label: 'Auditoria',          href: '/auditoria',              icon: Shield },
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
  const unreadCount = useUnreadCount()

  const visibleGroups = navGroups
    .filter((group) => !group.roles || (user && group.roles.includes(user.role)))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (user && item.roles.includes(user.role))
      ),
    }))
    .filter((group) => group.items.length > 0)

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
    consultor: 'Consultor',
    caixa: 'Caixa',
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
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <div className="bg-white rounded-lg px-3 py-1.5 flex items-center">
            <Image
              src="/logo.png"
              alt="SIAFI"
              width={130}
              height={36}
              className="object-contain h-8 w-auto"
              priority
            />
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
                const badgeCount = item.badge === 'unread' ? unreadCount : 0
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && !active && (
                      <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center px-1 font-bold">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                    {active && <ChevronRight className="size-3 opacity-60" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
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
