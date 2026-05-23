'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users, CreditCard, AlertCircle, Search, ChevronRight, TrendingUp,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ClienteCarteira {
  id: number
  nome: string
  cpf: string | null
  whatsapp: string | null
  loans: Array<{
    id: number
    status: string
    principalAmount: number
    totalReceivable: number
    numeroParcelas: number
  }>
}

interface Stats {
  totalClientes: number
  emprestimoAtivos: number
  parcelasAtrasadas: number
}

const colorMap = {
  blue:  { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600', value: 'text-blue-700 dark:text-blue-400' },
  green: { bg: 'bg-green-50 dark:bg-green-950/30', icon: 'bg-green-100 dark:bg-green-900/40 text-green-600', value: 'text-green-700 dark:text-green-400' },
  red:   { bg: 'bg-red-50 dark:bg-red-950/30', icon: 'bg-red-100 dark:bg-red-900/40 text-red-600', value: 'text-red-700 dark:text-red-400' },
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType
  color: keyof typeof colorMap
}) {
  const c = colorMap[color]
  return (
    <Card className={cn('border-0 shadow-sm', c.bg)}>
      <CardContent className="flex items-center gap-4 pt-5 pb-5">
        <div className={cn('size-10 rounded-lg flex items-center justify-center shrink-0', c.icon)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className={cn('text-2xl font-bold', c.value)}>{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function getInitials(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function CarteiraPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['consultor-stats'],
    queryFn: () => api.get('/consultor/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: clientes, isLoading: clientesLoading } = useQuery<ClienteCarteira[]>({
    queryKey: ['consultor-carteira'],
    queryFn: () => api.get('/consultor/carteira').then(r => r.data),
    refetchInterval: 120_000,
  })

  const isLoading = statsLoading || clientesLoading

  const clientesFiltrados = useMemo(() => {
    if (!clientes) return []
    if (!search.trim()) return clientes
    const q = search.toLowerCase()
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.cpf && c.cpf.includes(q)) ||
      (c.whatsapp && c.whatsapp.includes(q))
    )
  }, [clientes, search])

  const inadimplentes = clientesFiltrados.filter(c =>
    c.loans.some(l => l.status === 'inadimplente')
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Carteira</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bem-vindo, {user?.nome}. Gerencie seus clientes e acompanhe sua carteira.
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Clientes na carteira" value={stats?.totalClientes ?? 0} icon={Users} color="blue" />
          <StatCard label="Empréstimos ativos" value={stats?.emprestimoAtivos ?? 0} icon={CreditCard} color="green" />
          <StatCard label="Parcelas atrasadas" value={stats?.parcelasAtrasadas ?? 0} icon={AlertCircle} color="red" />
        </div>
      )}

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-3">
        <Link href="/clientes/novo">
          <Button>
            <Users className="size-4 mr-2" />
            Novo Cliente
          </Button>
        </Link>
        <Link href="/intencoes">
          <Button variant="outline">
            <TrendingUp className="size-4 mr-2" />
            Intenções
          </Button>
        </Link>
        <Link href="/cobrancas">
          <Button variant="outline">Registrar Cobrança</Button>
        </Link>
        <Link href="/consultor/relatorios">
          <Button variant="outline">Ver Relatórios</Button>
        </Link>
      </div>

      {/* Lista de clientes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Clientes da Carteira
              {!isLoading && clientes && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({clientesFiltrados.length}/{clientes.length})
                  {inadimplentes > 0 && (
                    <span className="text-red-500 ml-1">· {inadimplentes} inadimplente{inadimplentes !== 1 ? 's' : ''}</span>
                  )}
                </span>
              )}
            </CardTitle>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Buscar cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !clientesFiltrados.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-8 mx-auto mb-2 opacity-40" />
              <p>{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente na carteira ainda.'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {clientesFiltrados.map(cliente => {
                const ativos = cliente.loans.filter(
                  l => l.status === 'ativo' || l.status === 'inadimplente' || l.status === 'aguardando_aceite' || l.status === 'aguardando_liberacao'
                )
                const inadimplente = cliente.loans.some(l => l.status === 'inadimplente')
                const totalReceivable = ativos.reduce((s, l) => s + Number(l.totalReceivable), 0)

                return (
                  <div key={cliente.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'size-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold',
                        inadimplente
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/40'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800',
                      )}>
                        {getInitials(cliente.nome)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{cliente.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {cliente.cpf ?? cliente.whatsapp ?? 'Sem contato'}
                          {ativos.length > 0 && (
                            <> · {ativos.length} contrato{ativos.length !== 1 ? 's' : ''} · {formatCurrency(totalReceivable)} a receber</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {inadimplente && (
                        <Badge variant="destructive" className="text-xs hidden sm:flex">Inadimplente</Badge>
                      )}
                      <Link href={`/consultor/carteira/${cliente.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs">
                          Ver <ChevronRight className="size-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
