'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertCircle, RefreshCw, Calendar, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatDateLocal, toNumber, STATUS_INSTALLMENT } from '@/lib/utils'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'

interface Installment {
  id: number
  numero: number
  installmentAmount: string
  dataVencimento: string
  status: string
  totalPago: string
  saldoDevedor: string
  moraAcumulada: string
  multaAplicada: string
  loan: { id: number; client: { id: number; nome: string } }
}

type TabKey = 'hoje' | 'atrasado'

export default function ParcelasPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabKey>('hoje')
  const showSplit = user?.role !== 'caixa'

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
    return Math.max(0, Math.floor((now.getTime() - venc.getTime()) / 86400000))
  }

  // Totalizadores
  const totalValor    = activeData?.reduce((s, i) => s + toNumber(i.installmentAmount), 0) ?? 0
  const totalPago     = activeData?.reduce((s, i) => s + toNumber(i.totalPago), 0) ?? 0
  const totalSaldo    = activeData?.reduce((s, i) => s + toNumber(i.saldoDevedor), 0) ?? 0
  const totalEncargos = activeData?.reduce((s, i) => s + toNumber(i.moraAcumulada) + toNumber(i.multaAplicada), 0) ?? 0

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
        {([
          { key: 'hoje' as const, label: 'Hoje', icon: Calendar, data: hoje, color: 'text-primary border-primary', pill: 'bg-primary/15 text-primary' },
          { key: 'atrasado' as const, label: 'Em Atraso', icon: AlertCircle, data: overdue, color: 'text-destructive border-destructive', pill: 'bg-destructive/15 text-destructive' },
        ]).map(({ key, label, icon: Icon, data: d, color, pill }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
              tab === key ? color : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />{label}
            {!!d?.length && (
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[1.2rem] text-center', tab === key ? pill : 'bg-muted text-muted-foreground')}>
                {d.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
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
              {tab === 'hoje' ? 'Sem vencimentos para o dia de hoje.' : 'Todos os clientes estão em dia.'}
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
                    {showSplit && (
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Pago</th>
                    )}
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo</th>
                    {tab === 'atrasado' && (
                      <>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Encargos</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Atraso</th>
                      </>
                    )}
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.map(inst => {
                    const saldo = toNumber(inst.saldoDevedor) || Math.max(0, toNumber(inst.installmentAmount) - toNumber(inst.totalPago))
                    const dias  = tab === 'atrasado' ? diasAtraso(inst.dataVencimento) : 0
                    const encargos = toNumber(inst.moraAcumulada) + toNumber(inst.multaAplicada)
                    const ist = STATUS_INSTALLMENT[inst.status] ?? { label: inst.status, variant: 'outline' as const }
                    return (
                      <tr key={inst.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/clientes/${inst.loan.client.id}`} className="font-medium hover:underline">
                            {inst.loan.client.nome}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          <Link href={`/emprestimos/${inst.loan.id}`} className="hover:underline">
                            #{inst.loan.id} · P{inst.numero}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className={tab === 'hoje' ? 'font-medium text-amber-600' : ''}>
                            {formatDateLocal(inst.dataVencimento)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(inst.installmentAmount)}</td>
                        {showSplit && (
                          <td className="px-4 py-3 text-right text-green-600 hidden lg:table-cell">
                            {formatCurrency(inst.totalPago)}
                          </td>
                        )}
                        <td className={cn('px-4 py-3 text-right font-bold', saldo > 0 ? 'text-destructive' : 'text-green-600')}>
                          {formatCurrency(saldo)}
                        </td>
                        {tab === 'atrasado' && (
                          <>
                            <td className="px-4 py-3 text-right text-orange-600 hidden md:table-cell">
                              {encargos > 0 ? formatCurrency(encargos) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <Badge variant="destructive">{dias}d</Badge>
                            </td>
                          </>
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
                {/* Totalizadores */}
                <tfoot>
                  <tr className="bg-muted/40 border-t font-medium text-sm">
                    <td colSpan={3} className="px-4 py-2.5 text-xs text-muted-foreground">
                      {activeData.length} parcela{activeData.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">{formatCurrency(totalValor)}</td>
                    {showSplit && (
                      <td className="px-4 py-2.5 text-right text-xs text-green-600 hidden lg:table-cell">
                        {formatCurrency(totalPago)}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right text-xs text-destructive">{formatCurrency(totalSaldo)}</td>
                    {tab === 'atrasado' && (
                      <>
                        <td className="px-4 py-2.5 text-right text-xs text-orange-600 hidden md:table-cell">
                          {totalEncargos > 0 ? formatCurrency(totalEncargos) : '—'}
                        </td>
                        <td />
                      </>
                    )}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
