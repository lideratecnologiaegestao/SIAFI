'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Users, CreditCard, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

interface ClienteCarteira {
  id: number
  nome: string
  cpf: string | null
  whatsapp: string | null
  loans: Array<{ id: number; status: string; valor: number; numeroParcelas: number }>
}

interface Stats {
  totalClientes: number
  emprestimoAtivos: number
  parcelasAtrasadas: number
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Icon className="size-5 text-blue-600" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
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

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['consultor-stats'],
    queryFn: () => api.get('/consultor/stats').then(r => r.data),
  })

  const { data: clientes, isLoading: clientesLoading } = useQuery<ClienteCarteira[]>({
    queryKey: ['consultor-carteira'],
    queryFn: () => api.get('/consultor/carteira').then(r => r.data),
  })

  const isLoading = statsLoading || clientesLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Carteira</h1>
        <p className="text-muted-foreground">Bem-vindo, {user?.nome}. Gerencie seus clientes e acompanhe sua carteira.</p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Clientes na carteira" value={stats?.totalClientes ?? 0} icon={Users} />
          <StatCard label="Empréstimos ativos" value={stats?.emprestimoAtivos ?? 0} icon={CreditCard} />
          <StatCard label="Parcelas atrasadas" value={stats?.parcelasAtrasadas ?? 0} icon={AlertCircle} />
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
        <Link href="/solicitacoes">
          <Button variant="outline">Minhas Solicitações</Button>
        </Link>
        <Link href="/intencoes">
          <Button variant="outline">Intenções de Empréstimo</Button>
        </Link>
        <Link href="/cobrancas">
          <Button variant="outline">Registrar Cobrança</Button>
        </Link>
      </div>

      {/* Lista de clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes da Carteira</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !clientes?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum cliente na carteira ainda.</p>
            </div>
          ) : (
            <div className="divide-y">
              {clientes.map(cliente => {
                const ativos = cliente.loans.filter(l => l.status === 'ativo' || l.status === 'inadimplente')
                const inadimplente = cliente.loans.some(l => l.status === 'inadimplente')
                return (
                  <div key={cliente.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-slate-600">{getInitials(cliente.nome)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{cliente.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {cliente.cpf ?? cliente.whatsapp ?? 'Sem contato'}
                          {' · '}
                          {ativos.length} empréstimo{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inadimplente && (
                        <Badge variant="destructive" className="text-xs">Inadimplente</Badge>
                      )}
                      <Link href={`/consultor/carteira/${cliente.id}`}>
                        <Button variant="ghost" size="sm">Ver</Button>
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
