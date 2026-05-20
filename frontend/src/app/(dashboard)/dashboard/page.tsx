'use client'

import { useQueries } from '@tanstack/react-query'
import { Users, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'
import { useAuth } from '@/contexts/auth.context'

interface ClientStats {
  total: number
  ativos: number
  inativos: number
  quitados: number
  atrasados: number
}

interface LoanStats {
  totalAtivos: number
  totalQuitados: number
  valorEmCarteira: number
  valorRecebidoMes: number
}

interface OverdueInstallment {
  id: number
  numero: number
  dataVencimento: string
  valor: number
  totalPago: number
  loan: {
    id: number
    client: { id: number; nome: string }
  }
}

interface QuitadoClient {
  id: number
  nome: string
  cpf: string | null
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors',
    icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-400',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors',
    icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-400',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
    value: 'text-purple-700 dark:text-purple-400',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors',
    icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-400',
  },
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  color: keyof typeof colorMap
  isLoading: boolean
  href?: string
}

function StatCard({ title, value, icon: Icon, color, isLoading, href }: StatCardProps) {
  const colors = colorMap[color]
  const content = (
    <Card className={cn('border-0 shadow-sm cursor-default', colors.bg, href && 'cursor-pointer')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('rounded-lg p-2', colors.icon)}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        {isLoading ? (
          <Skeleton className="h-8 w-28 mb-1" />
        ) : (
          <p className={cn('text-2xl font-bold', colors.value)}>{value}</p>
        )}
        {href && <ChevronRight className="size-4 text-muted-foreground" />}
      </CardContent>
    </Card>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}

export default function DashboardPage() {
  const { connected } = useRealtimeDashboard()
  const { user } = useAuth()
  const canSeeLoansStats = user?.role === 'admin' || user?.role === 'financeiro'

  const results = useQueries({
    queries: [
      {
        queryKey: ['clients', 'stats'],
        queryFn: () => api.get<ClientStats>('/clients/stats').then((r) => r.data),
      },
      {
        queryKey: ['loans', 'stats'],
        queryFn: () => api.get<LoanStats>('/loans/stats').then((r) => r.data),
        enabled: canSeeLoansStats,
      },
      {
        queryKey: ['installments', 'overdue'],
        queryFn: () => api.get<OverdueInstallment[]>('/installments/overdue').then((r) => r.data),
      },
      {
        queryKey: ['clients', 'quitados'],
        queryFn: () => api.get<QuitadoClient[]>('/clients/quitados').then((r) => r.data),
      },
    ],
  })

  const [clientsQuery, loansQuery, overdueQuery, quitadosQuery] = results
  const isAnyLoading = results.some((r) => r.isLoading)
  const isAnyError = results.some((r) => r.isError)

  function refetchAll() { results.forEach((r) => r.refetch()) }

  // Group overdue installments by unique client
  const overdueClients = overdueQuery.data
    ? Array.from(
        new Map(
          overdueQuery.data.map((i) => [i.loan.client.id, i.loan.client])
        ).values()
      )
    : []

  const lastUpdated = results
    .map((r) => r.dataUpdatedAt)
    .filter(Boolean)
    .reduce((max, t) => Math.max(max, t), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight">Visão Geral</h2>
            <span title={connected ? 'Realtime conectado' : 'Conectando...'} className="relative flex size-2 shrink-0">
              {connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={cn('relative inline-flex rounded-full size-2', connected ? 'bg-green-500' : 'bg-slate-300')} />
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Resumo financeiro atualizado em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated > 0 && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              Atualizado em {formatDate(new Date(lastUpdated))}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={isAnyLoading} className="gap-2">
            <RefreshCw className={cn('size-3.5', isAnyLoading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {isAnyError && !isAnyLoading && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-destructive">Falha ao carregar alguns dados.</p>
          <Button variant="outline" size="sm" onClick={refetchAll} className="text-destructive border-destructive/30">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* 4 stat cards — Clientes Ativos e Empréstimos Ativos são clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Clientes Ativos"
          value={clientsQuery.data?.ativos ?? '—'}
          icon={Users}
          color="blue"
          isLoading={clientsQuery.isLoading}
          href="/clientes"
        />
        <StatCard
          title="Empréstimos Ativos"
          value={loansQuery.data?.totalAtivos ?? '—'}
          icon={TrendingUp}
          color="green"
          isLoading={loansQuery.isLoading}
          href="/emprestimos"
        />
        <StatCard
          title="Clientes Atrasados"
          value={clientsQuery.data?.atrasados ?? overdueClients.length}
          icon={AlertTriangle}
          color="red"
          isLoading={clientsQuery.isLoading}
          href="/inadimplentes"
        />
        <StatCard
          title="Clientes Quitados"
          value={clientsQuery.data?.quitados ?? '—'}
          icon={CheckCircle}
          color="purple"
          isLoading={clientsQuery.isLoading}
        />
      </div>

      {/* 2 list cards: Clientes Atrasados e Clientes Quitados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" />
              Clientes Atrasados
            </CardTitle>
            <Link href="/inadimplentes">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                Ver todos <ChevronRight className="size-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {overdueQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : overdueClients.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="size-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm text-green-600 font-medium">Nenhum cliente em atraso!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {overdueClients.slice(0, 8).map((client) => {
                  const installmentsCount = overdueQuery.data?.filter(
                    (i) => i.loan.client.id === client.id
                  ).length ?? 0
                  return (
                    <Link key={client.id} href={`/clientes/${client.id}`}>
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <span className="text-sm font-medium">{client.nome}</span>
                        <Badge variant="destructive" className="text-xs">
                          {installmentsCount} parcela{installmentsCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
                {overdueClients.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{overdueClients.length - 8} clientes
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="size-4 text-green-500" />
              Clientes Quitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quitadosQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : !quitadosQuery.data?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente quitado.</p>
            ) : (
              <div className="space-y-1">
                {quitadosQuery.data.slice(0, 8).map((client) => (
                  <Link key={client.id} href={`/clientes/${client.id}`}>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium">{client.nome}</span>
                      <Badge variant="success" className="text-xs">Quitado</Badge>
                    </div>
                  </Link>
                ))}
                {quitadosQuery.data.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{quitadosQuery.data.length - 8} clientes
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
