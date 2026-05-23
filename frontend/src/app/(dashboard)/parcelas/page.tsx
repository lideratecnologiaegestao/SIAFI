'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertCircle, RefreshCw, Calendar, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'

interface Installment {
  id: number; numero: number; valor: number; dataVencimento: string
  status: string; totalPago: number; saldoDevedor?: number
  loan: { id: number; client: { id: number; nome: string } }
}

type TabKey = 'hoje' | 'atrasado'

export default function ParcelasPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabKey>('hoje')
  const showPago = user?.role !== 'caixa'

  const { data: hoje, isLoading: loadingHoje, refetch: refetchHoje } = useQuery<Installment[]>({
    queryKey: ['installments', 'hoje'],
    queryFn: () => api.get<Installment[]>('/installments/hoje').then(r => r.data),
  })

  const { data: overdue, isLoading: loadingOverdue, refetch: refetchOverdue } = useQuery<Installment[]>({
    queryKey: ['installments', 'overdue'],
    queryFn: () => api.get<Installment[]>('/installments/overdue').then(r => r.data),
  })

  const activeData = tab === 'hoje' ? hoje : overdue
  const isLoading  = tab === 'hoje' ? loadingHoje : loadingOverdue

  const diasAtraso = (dataVencimento: string) => {
    const now  = new Date(); now.setHours(0, 0, 0, 0)
    const venc = new Date(dataVencimento); venc.setHours(0, 0, 0, 0)
    return Math.floor((now.getTime() - venc.getTime()) / 86400000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parcelas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tab === 'hoje' ? 'Vencimentos de hoje' : 'Parcelas vencidas e em atraso'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchHoje(); refetchOverdue() }} className="gap-2">
          <RefreshCw className="size-3.5" />Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b">
        <button
          onClick={() => setTab('hoje')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
            tab === 'hoje'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Calendar className="size-3.5" />Hoje
          {!!hoje?.length && (
            <span className={cn(
              'text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[1.2rem] text-center',
              tab === 'hoje' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}>
              {hoje.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('atrasado')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
            tab === 'atrasado'
              ? 'border-destructive text-destructive'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <AlertCircle className="size-3.5" />Em Atraso
          {!!overdue?.length && (
            <span className={cn(
              'text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[1.2rem] text-center',
              tab === 'atrasado' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground',
            )}>
              {overdue.length}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      ) : !activeData?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-green-700 dark:text-green-400">
              {tab === 'hoje' ? 'Nenhuma parcela vence hoje!' : 'Nenhuma parcela em atraso!'}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {tab === 'hoje'
                ? 'Sem vencimentos para o dia de hoje.'
                : 'Todos os clientes estão em dia.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Parcela</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    {showPago && (
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Pago</th>
                    )}
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo</th>
                    {tab === 'atrasado' && (
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Atraso</th>
                    )}
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.map(inst => {
                    const saldo = Number(inst.saldoDevedor ?? 0) || (Number(inst.valor) - Number(inst.totalPago))
                    const dias  = tab === 'atrasado' ? diasAtraso(inst.dataVencimento) : 0
                    return (
                      <tr key={inst.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/clientes/${inst.loan.client.id}`}
                            className="font-medium hover:underline"
                          >
                            {inst.loan.client.nome}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          <Link href={`/emprestimos/${inst.loan.id}`} className="hover:underline">
                            #{inst.loan.id} · P{inst.numero}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(inst.dataVencimento)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(inst.valor)}</td>
                        {showPago && (
                          <td className="px-4 py-3 text-right text-green-600 hidden lg:table-cell">
                            {formatCurrency(inst.totalPago)}
                          </td>
                        )}
                        <td className={cn(
                          'px-4 py-3 text-right font-bold',
                          saldo > 0 ? 'text-destructive' : 'text-green-600',
                        )}>
                          {formatCurrency(saldo)}
                        </td>
                        {tab === 'atrasado' && (
                          <td className="px-4 py-3 text-center hidden md:table-cell">
                            <Badge variant="destructive">{dias}d</Badge>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <Link href={`/pagamentos/novo?parcelaId=${inst.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs">Pagar</Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
