'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Search, RefreshCw, Eye, XCircle, CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { formatCurrency, formatDate, formatCPF, STATUS_LOAN } from '@/lib/utils'
import api from '@/lib/api'

interface Loan {
  id: number; valor: number; taxaJuros: number; modoTaxa: string
  numeroParcelas: number; dataInicio: string; status: string
  client: { id: number; nome: string; cpf: string }
}

interface LoansResponse { data: Loan[]; total: number; page: number; lastPage: number }

export default function EmprestimosPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['loans', { search, status, page }],
    queryFn: () => api.get<LoansResponse>('/loans', {
      params: { search: search || undefined, status: status || undefined, page, limit: 20 },
    }).then((r) => r.data),
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => api.patch(`/loans/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  })

  function handleCancel(id: number) {
    if (confirm('Cancelar este empréstimo? Esta ação não pode ser desfeita.')) cancelMut.mutate(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empréstimos</h1>
          <p className="text-muted-foreground text-sm mt-1">Contratos e parcelas</p>
        </div>
        <Link href="/emprestimos/novo">
          <Button className="gap-2"><Plus className="size-4" />Novo Empréstimo</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente ou CPF..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
            </div>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-44">
              <option value="">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="quitado">Quitados</option>
              <option value="inadimplente">Inadimplentes</option>
              <option value="cancelado">Cancelados</option>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="size-3.5" />Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : isError ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Erro ao carregar empréstimos.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">Tentar novamente</Button>
            </div>
          ) : !data?.data.length ? (
            <div className="p-8 text-center">
              <CreditCard className="size-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum empréstimo encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">CPF</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Taxa</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Parcelas</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Início</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((loan) => {
                    const st = STATUS_LOAN[loan.status] ?? { label: loan.status, variant: 'outline' as const }
                    return (
                      <tr key={loan.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{loan.client?.nome ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{loan.client?.cpf ? formatCPF(loan.client.cpf) : '—'}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(loan.valor)}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground hidden lg:table-cell">
                          {loan.taxaJuros}% {loan.modoTaxa === 'mensal' ? 'a.m.' : 'a.a.'}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground hidden lg:table-cell">{loan.numeroParcelas}x</td>
                        <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">{formatDate(loan.dataInicio)}</td>
                        <td className="px-4 py-3 text-center"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/emprestimos/${loan.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="size-3.5" /></Button>
                            </Link>
                            {loan.status === 'ativo' && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleCancel(loan.id)} disabled={cancelMut.isPending}>
                                <XCircle className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {data.total} empréstimo{data.total !== 1 ? 's' : ''}
                  {status && ` ${STATUS_LOAN[status]?.label?.toLowerCase() ?? status}`}
                </p>
                {data.data.length > 0 && (
                  <p className="text-sm font-medium">
                    Total: {formatCurrency(data.data.reduce((s, l) => s + Number(l.valor), 0))}
                  </p>
                )}
              </div>
              {data.lastPage > 1 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {data.lastPage}</span>
                  <Button variant="outline" size="sm" disabled={page === data.lastPage} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
