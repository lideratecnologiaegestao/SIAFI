'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, RefreshCw, Wallet, Undo2, FileDown } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate, METODO_PAGAMENTO } from '@/lib/utils'
import api from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth.context'

interface Payment {
  id: number; valorPago: number; dataPagamento: string; metodoPagamento: string; observacao: string
  installment: { id: number; numero: number; loan: { id: number; client: { nome: string } } }
}

export default function PagamentosPage() {
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const { user } = useAuth()
  const canEstornar = user?.role === 'admin' || user?.role === 'financeiro'

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['payments', { search }],
    queryFn: () => api.get<Payment[]>('/payments', { params: { search: search || undefined, limit: 50 } }).then((r) => r.data),
  })

  const estornoMut = useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}/estornar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })

  function handleEstorno(id: number) {
    if (confirm('Estornar este pagamento? A parcela voltará ao status anterior.')) estornoMut.mutate(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1><p className="text-muted-foreground text-sm mt-1">Histórico de recebimentos</p></div>
        <Link href="/pagamentos/novo"><Button className="gap-2"><Plus className="size-4" />Registrar Pagamento</Button></Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2"><RefreshCw className="size-3.5" />Atualizar</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : isError ? (
            <div className="p-8 text-center text-muted-foreground"><p>Erro ao carregar pagamentos.</p><Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">Tentar novamente</Button></div>
          ) : !data?.length ? (
            <div className="p-8 text-center"><Wallet className="size-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground text-sm">Nenhum pagamento encontrado.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Empréstimo</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Parcela</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Método</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Data</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((p) => (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{p.installment?.loan?.client?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        <Link href={`/emprestimos/${p.installment?.loan?.id}`} className="hover:underline">#{p.installment?.loan?.id}</Link>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground hidden lg:table-cell">P{p.installment?.numero}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(p.valorPago)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline">{METODO_PAGAMENTO[p.metodoPagamento] ?? p.metodoPagamento}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(p.dataPagamento)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={async () => {
                            const res = await api.get(`/export/pagamentos/${p.id}/recibo`, { responseType: 'blob' })
                            const a = document.createElement('a')
                            a.href = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }))
                            a.download = `recibo-${p.id}.pdf`
                            a.click()
                            URL.revokeObjectURL(a.href)
                          }}><FileDown className="size-3" />Recibo</Button>
                          {canEstornar && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={() => handleEstorno(p.id)} disabled={estornoMut.isPending}>
                              <Undo2 className="size-3" />Estornar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
