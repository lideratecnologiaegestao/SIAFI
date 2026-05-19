'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import api from '@/lib/api'

interface AuditLog {
  id: number; acao: string; entidade: string; entidadeId: number
  dados: any; ip: string; createdAt: string
  user?: { nome: string }
}
interface AuditResponse { data: AuditLog[]; total: number; page: number; lastPage: number }

const ENTIDADE_COLORS: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700',
  loan: 'bg-purple-100 text-purple-700',
  payment: 'bg-green-100 text-green-700',
  transaction: 'bg-orange-100 text-orange-700',
  user: 'bg-slate-100 text-slate-700',
}

export default function AuditoriaPage() {
  const [page, setPage] = useState(1)
  const [entidade, setEntidade] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', { page, entidade }],
    queryFn: () => api.get<AuditResponse>('/audit', {
      params: { page, limit: 30, entidade: entidade || undefined },
    }).then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Shield className="size-6" />Auditoria</h1>
          <p className="text-muted-foreground text-sm mt-1">Registro de ações do sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2"><RefreshCw className="size-3.5" />Atualizar</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Filtrar por entidade (client, loan, payment...)" value={entidade}
                onChange={(e) => { setEntidade(e.target.value); setPage(1) }} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : isError ? (
            <div className="p-8 text-center text-muted-foreground"><p>Erro ao carregar logs.</p><Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">Tentar novamente</Button></div>
          ) : !data?.data.length ? (
            <div className="p-8 text-center"><Shield className="size-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground text-sm">Nenhum registro de auditoria.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data/Hora</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ação</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entidade</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((log) => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2.5 font-medium">{log.user?.nome ?? 'Sistema'}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs">{log.acao}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ENTIDADE_COLORS[log.entidade] ?? 'bg-gray-100 text-gray-700'}`}>
                          {log.entidade}
                          {log.entidadeId ? ` #${log.entidadeId}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs hidden xl:table-cell">{log.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">{data.total} registros</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {data.lastPage}</span>
                <Button variant="outline" size="sm" disabled={page === data.lastPage} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
