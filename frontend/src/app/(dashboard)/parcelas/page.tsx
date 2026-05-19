'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate, STATUS_INSTALLMENT } from '@/lib/utils'
import api from '@/lib/api'

interface OverdueInstallment {
  id: number; numero: number; valor: number; dataVencimento: string
  status: string; totalPago: number
  loan: { id: number; client: { id: number; nome: string; cpf: string } }
}

export default function ParcelasPage() {
  const { data: overdue, isLoading, isError, refetch } = useQuery({
    queryKey: ['installments', 'overdue'],
    queryFn: () => api.get<OverdueInstallment[]>('/installments/overdue').then((r) => r.data),
  })

  const diasAtraso = (dataVencimento: string) => {
    const hoje = new Date()
    const venc = new Date(dataVencimento)
    const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parcelas</h1>
          <p className="text-muted-foreground text-sm mt-1">Parcelas vencidas e em atraso</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="size-3.5" />Atualizar
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
      ) : isError ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <p>Erro ao carregar parcelas.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">Tentar novamente</Button>
        </CardContent></Card>
      ) : !overdue?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-green-700 dark:text-green-400">Nenhuma parcela em atraso!</h3>
            <p className="text-muted-foreground text-sm mt-1">Todos os clientes estão em dia.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" />
              {overdue.length} parcela{overdue.length !== 1 ? 's' : ''} em atraso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Parcela</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Pago</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Atraso</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()).map((inst) => {
                    const saldo = Number(inst.valor) - Number(inst.totalPago)
                    const dias = diasAtraso(inst.dataVencimento)
                    return (
                      <tr key={inst.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/clientes/${inst.loan.client.id}`} className="font-medium hover:underline">{inst.loan.client.nome}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          <Link href={`/emprestimos/${inst.loan.id}`} className="hover:underline">#{inst.loan.id} · P{inst.numero}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(inst.dataVencimento)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(inst.valor)}</td>
                        <td className="px-4 py-3 text-right text-green-600 hidden lg:table-cell">{formatCurrency(inst.totalPago)}</td>
                        <td className="px-4 py-3 text-right font-bold text-destructive">{formatCurrency(saldo)}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <Badge variant="destructive">{dias}d</Badge>
                        </td>
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
