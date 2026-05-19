'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Search, RefreshCw, Eye, Pencil, Trash2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { formatCPF, formatPhone, formatDate } from '@/lib/utils'
import api from '@/lib/api'

interface Client {
  id: number
  nome: string
  cpf: string
  whatsapp: string
  email: string
  cidade: string
  estado: string
  active: boolean
  createdAt: string
}

interface ClientsResponse {
  data: Client[]
  total: number
  page: number
  lastPage: number
}

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clients', { search, status, page }],
    queryFn: () =>
      api.get<ClientsResponse>('/clients', {
        params: { search: search || undefined, status: status || undefined, page, limit: 20 },
      }).then((r) => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  function handleDelete(id: number, nome: string) {
    if (confirm(`Desativar cliente "${nome}"?`)) deleteMut.mutate(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de clientes cadastrados</p>
        </div>
        <Link href="/clientes/novo">
          <Button className="gap-2"><Plus className="size-4" />Novo Cliente</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou WhatsApp..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-40">
              <option value="">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="size-3.5" />Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Erro ao carregar clientes.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">Tentar novamente</Button>
            </div>
          ) : !data?.data.length ? (
            <div className="p-8 text-center">
              <Users className="size-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">CPF</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">WhatsApp</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Cidade/UF</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Cadastro</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((c) => (
                    <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatCPF(c.cpf)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.whatsapp ? formatPhone(c.whatsapp) : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">{c.cidade}{c.estado ? `/${c.estado}` : ''}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={c.active ? 'success' : 'outline'}>
                          {c.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/clientes/${c.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="size-3.5" /></Button>
                          </Link>
                          <Link href={`/clientes/${c.id}/editar`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="size-3.5" /></Button>
                          </Link>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(c.id, c.nome)}
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {data.total} cliente{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <span className="flex items-center text-sm text-muted-foreground px-2">
                  {page} / {data.lastPage}
                </span>
                <Button variant="outline" size="sm" disabled={page === data.lastPage} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
