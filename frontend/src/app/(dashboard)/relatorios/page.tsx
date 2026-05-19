'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, Download, RefreshCw, TrendingUp, Users, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate, STATUS_LOAN } from '@/lib/utils'
import api from '@/lib/api'

type ReportTab = 'movimentacao' | 'carteira' | 'clientes' | 'contratos'

export default function RelatoriosPage() {
  const [tab, setTab] = useState<ReportTab>('carteira')
  const today = new Date()
  const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('')

  const { data: carteiraData, isLoading: loadingCarteira } = useQuery({
    queryKey: ['reports', 'carteira'],
    queryFn: () => api.get<any>('/reports/carteira').then((r) => r.data),
    enabled: tab === 'carteira',
  })

  const { data: clientesData, isLoading: loadingClientes } = useQuery({
    queryKey: ['reports', 'clientes'],
    queryFn: () => api.get<any>('/reports/clientes').then((r) => r.data),
    enabled: tab === 'clientes',
  })

  const { data: movData, isLoading: loadingMov, refetch: refetchMov } = useQuery({
    queryKey: ['reports', 'movimentacao', startDate, endDate],
    queryFn: () => api.get<any>('/reports/movimentacao', { params: { startDate, endDate } }).then((r) => r.data),
    enabled: tab === 'movimentacao',
  })

  const { data: contratosData, isLoading: loadingContratos, refetch: refetchContratos } = useQuery({
    queryKey: ['reports', 'contratos', statusFilter],
    queryFn: () => api.get<any>('/reports/contratos', { params: { status: statusFilter || undefined } }).then((r) => r.data),
    enabled: tab === 'contratos',
  })

  const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: 'carteira', label: 'Carteira', icon: TrendingUp },
    { key: 'clientes', label: 'Clientes', icon: Users },
    { key: 'movimentacao', label: 'Movimentação', icon: BarChart2 },
    { key: 'contratos', label: 'Contratos', icon: FileText },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BarChart2 className="size-6" />Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Análises e dados do sistema</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <Button key={key} variant={tab === key ? 'default' : 'outline'} size="sm" onClick={() => setTab(key)} className="gap-2">
            <Icon className="size-3.5" />{label}
          </Button>
        ))}
      </div>

      {tab === 'carteira' && (
        <div className="space-y-4">
          {loadingCarteira ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : carteiraData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Valor Investido', value: carteiraData.valorInvestido ?? 0, format: true, color: 'text-foreground' },
                  { label: 'Valor Total Parcelado', value: carteiraData.valorTotalParcelado ?? 0, format: true, color: 'text-blue-700' },
                  { label: 'Valor Recebido', value: carteiraData.valorRecebido ?? 0, format: true, color: 'text-green-700' },
                  { label: 'A Receber', value: carteiraData.aReceber ?? 0, format: true, color: 'text-orange-600' },
                ].map((item) => (
                  <Card key={item.label}>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={`text-xl font-bold mt-1 ${item.color}`}>{item.format ? formatCurrency(item.value as number) : item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-50 dark:bg-green-950/20">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Empréstimos Ativos</p>
                    <p className="text-xl font-bold mt-1 text-green-700">{carteiraData.totalAtivos ?? '—'}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-950/20">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Empréstimos em Atraso</p>
                    <p className="text-xl font-bold mt-1 text-red-700">{carteiraData.totalAtrasados ?? '—'}</p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </div>
      )}

      {tab === 'clientes' && (
        <div className="space-y-4">
          {loadingClientes ? (
            <Skeleton className="h-48 w-full" />
          ) : clientesData ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Total de Clientes', value: clientesData.total ?? '—' },
                { label: 'Clientes Ativos', value: clientesData.ativos ?? '—' },
                { label: 'Clientes Inativos', value: clientesData.inativos ?? '—' },
                { label: 'Com Empréstimo Ativo', value: clientesData.comEmprestimoAtivo ?? '—' },
                { label: 'Inadimplentes', value: clientesData.inadimplentes ?? '—' },
                { label: 'Novos no Mês', value: clientesData.novosMes ?? '—' },
              ].map((item) => (
                <Card key={item.label}><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold mt-1">{item.value}</p>
                </CardContent></Card>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {tab === 'movimentacao' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex gap-4 flex-wrap items-end">
                <div className="space-y-1.5">
                  <Label>Data inicial</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-44" />
                </div>
                <div className="space-y-1.5">
                  <Label>Data final</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44" />
                </div>
                <Button onClick={() => refetchMov()} className="gap-2"><RefreshCw className="size-3.5" />Gerar</Button>
              </div>
            </CardHeader>
          </Card>
          {loadingMov ? <Skeleton className="h-48 w-full" /> : movData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-green-50 dark:bg-green-950/20"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-xl font-bold text-green-700">{formatCurrency(movData.entradas ?? 0)}</p></CardContent></Card>
              <Card className="bg-red-50 dark:bg-red-950/20"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-xl font-bold text-red-700">{formatCurrency(movData.saidas ?? 0)}</p></CardContent></Card>
              <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo</p><p className="text-xl font-bold text-blue-700">{formatCurrency(movData.saldo ?? 0)}</p></CardContent></Card>
            </div>
          ) : null}
        </div>
      )}

      {tab === 'contratos' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            {['', 'ativo', 'quitado', 'inadimplente', 'cancelado'].map((s) => (
              <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)}>
                {s === '' ? 'Todos' : STATUS_LOAN[s]?.label ?? s}
              </Button>
            ))}
          </div>
          {loadingContratos ? <Skeleton className="h-64 w-full" /> : (
            <Card>
              <CardContent className="p-0">
                {!contratosData?.length ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum contrato encontrado.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Parcelas</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Início</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contratosData.map((c: any) => {
                          const st = STATUS_LOAN[c.status] ?? { label: c.status, variant: 'outline' as const }
                          return (
                            <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                              <td className="px-4 py-2.5 text-muted-foreground">#{c.id}</td>
                              <td className="px-4 py-2.5 font-medium">{c.client?.nome}</td>
                              <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(c.valor)}</td>
                              <td className="px-4 py-2.5 text-center text-muted-foreground">{c.numeroParcelas}x</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(c.dataInicio)}</td>
                              <td className="px-4 py-2.5 text-center"><Badge variant={st.variant}>{st.label}</Badge></td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/30">
                          <td colSpan={2} className="px-4 py-2.5 font-semibold text-sm">{contratosData.length} contrato{contratosData.length !== 1 ? 's' : ''}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-sm">
                            {formatCurrency(contratosData.reduce((s: number, c: any) => s + Number(c.valor), 0))}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
