'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ListChecks, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'
import api from '@/lib/api'

export default function ConciliacaoPage() {
  const today = new Date()
  const [mes, setMes] = useState(today.getMonth() + 1)
  const [ano, setAno] = useState(today.getFullYear())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', 'movimento', mes, ano],
    queryFn: () => api.get<any>('/transactions/movimento', { params: { mes, ano } }).then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ListChecks className="size-6" />Conciliação</h1>
          <p className="text-muted-foreground text-sm mt-1">Movimento mensal por período</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <Input type="number" min="1" max="12" value={mes} onChange={(e) => setMes(Number(e.target.value))} className="w-24" />
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input type="number" min="2020" max="2099" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-28" />
            </div>
            <Button onClick={() => refetch()} className="gap-2"><RefreshCw className="size-3.5" />Consultar</Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entradas do Período</p><p className="text-2xl font-bold text-green-700">{formatCurrency(data.entradas ?? 0)}</p></CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
              <CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas do Período</p><p className="text-2xl font-bold text-red-700">{formatCurrency(data.saidas ?? 0)}</p></CardContent>
            </Card>
            <Card className={`${(data.saldo ?? 0) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo do Período</p><p className={`text-2xl font-bold ${(data.saldo ?? 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(data.saldo ?? 0)}</p></CardContent>
            </Card>
          </div>

          {data.transactions && data.transactions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Transações do Período</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t: any) => (
                      <tr key={t.id} className="border-b border-border hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(t.data)}</td>
                        <td className="px-4 py-2.5">{t.descricao}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{t.categoria || '—'}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.tipo === 'entrada' ? '+' : '-'}{formatCurrency(t.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
