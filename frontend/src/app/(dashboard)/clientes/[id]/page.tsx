'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Phone, Mail, MapPin, FileText, CreditCard, FolderOpen, ExternalLink, UserCheck, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { formatCPF, formatPhone, formatDate, formatCEP, formatCurrency, STATUS_LOAN } from '@/lib/utils'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'
import { PortalCard } from '@/components/portal/portal-card'

interface Consultor {
  id: number
  nome: string
}

interface Client {
  id: number; nome: string; cpf: string; rg: string; dataNascimento: string
  email: string; whatsapp: string; telefone: string; endereco: string
  bairro: string; cidade: string; estado: string; cep: string
  active: boolean; observacoes: string; createdAt: string
  fotoPath?: string; rgPath?: string; comprovantePath?: string
  consultor?: { id: number; nome: string } | null
  loans: Array<{ id: number; valor: number; numeroParcelas: number; status: string; dataInicio: string }>
}

interface DocumentUrls {
  fotoUrl?: string
  rgUrl?: string
  comprovanteUrl?: string
}

export default function ClienteDetalhePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showVincular, setShowVincular] = useState(false)
  const [selectedConsultorId, setSelectedConsultorId] = useState<string>('')

  const canManage = user?.role === 'admin' || user?.role === 'financeiro'

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<Client>(`/clients/${id}`).then((r) => r.data),
  })

  const { data: consultores } = useQuery<Consultor[]>({
    queryKey: ['consultores'],
    queryFn: () => api.get<Consultor[]>('/clients/consultores').then((r) => r.data),
    enabled: canManage && showVincular,
  })

  const vincularMut = useMutation({
    mutationFn: (consultorId: number | null) =>
      api.patch(`/clients/${id}/vincular-consultor`, { consultorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients', id] })
      setShowVincular(false)
      setSelectedConsultorId('')
    },
  })

  const hasDocuments = !!(client?.fotoPath || client?.rgPath || client?.comprovantePath)

  const { data: docUrls } = useQuery<DocumentUrls>({
    queryKey: ['clients', id, 'document-urls'],
    queryFn: () => api.get<DocumentUrls>(`/clients/${id}/document-urls`).then((r) => r.data),
    enabled: hasDocuments,
    staleTime: 50 * 60 * 1000, // refresh before signed URL expires (1h)
  })

  if (isLoading) return (
    <div className="space-y-6 max-w-4xl">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (isError || !client) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Cliente não encontrado.</p>
      <Link href="/clientes"><Button variant="outline" className="mt-4">Voltar</Button></Link>
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.nome}</h1>
            <p className="text-muted-foreground text-sm">Cliente #{client.id} · Cadastrado em {formatDate(client.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={client.active ? 'success' : 'outline'}>{client.active ? 'Ativo' : 'Inativo'}</Badge>
          <Link href={`/clientes/${client.id}/editar`}>
            <Button size="sm" className="gap-2"><Pencil className="size-3.5" />Editar</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="size-4" />Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">CPF</span><span className="font-medium">{formatCPF(client.cpf)}</span></div>
            {client.rg && <div className="flex justify-between"><span className="text-muted-foreground">RG</span><span className="font-medium">{client.rg}</span></div>}
            {client.dataNascimento && <div className="flex justify-between"><span className="text-muted-foreground">Nascimento</span><span className="font-medium">{formatDate(client.dataNascimento)}</span></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="size-4" />Contatos</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.whatsapp && <div className="flex justify-between"><span className="text-muted-foreground">WhatsApp</span><span className="font-medium">{formatPhone(client.whatsapp)}</span></div>}
            {client.telefone && <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><span className="font-medium">{formatPhone(client.telefone)}</span></div>}
            {client.email && <div className="flex justify-between items-center"><span className="text-muted-foreground">E-mail</span><span className="font-medium flex items-center gap-1"><Mail className="size-3" />{client.email}</span></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><UserCheck className="size-4" />Consultor</CardTitle>
              {canManage && (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { setShowVincular(true); setSelectedConsultorId(client.consultor ? String(client.consultor.id) : '') }}>
                  <Pencil className="size-3" />
                  {client.consultor ? 'Alterar' : 'Vincular'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {client.consultor ? (
              <p className="font-medium">{client.consultor.nome}</p>
            ) : (
              <p className="text-muted-foreground">Nenhum consultor vinculado</p>
            )}
          </CardContent>
        </Card>

        {(client.endereco || client.cidade) && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="size-4" />Endereço</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {client.endereco && <p>{client.endereco}{client.bairro ? `, ${client.bairro}` : ''}</p>}
              {(client.cidade || client.estado) && <p>{[client.cidade, client.estado].filter(Boolean).join(' - ')}{client.cep ? ` · CEP ${formatCEP(client.cep)}` : ''}</p>}
            </CardContent>
          </Card>
        )}

        {hasDocuments && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FolderOpen className="size-4" />Documentos</CardTitle></CardHeader>
            <CardContent>
              {docUrls ? (
                <div className="flex flex-wrap gap-3">
                  {docUrls.fotoUrl && (
                    <a
                      href={docUrls.fotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                      Foto do Cliente
                    </a>
                  )}
                  {docUrls.rgUrl && (
                    <a
                      href={docUrls.rgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                      RG
                    </a>
                  )}
                  {docUrls.comprovanteUrl && (
                    <a
                      href={docUrls.comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                      Comprovante de Endereço
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  {client.fotoPath && <Skeleton className="h-9 w-36" />}
                  {client.rgPath && <Skeleton className="h-9 w-20" />}
                  {client.comprovantePath && <Skeleton className="h-9 w-48" />}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {client.observacoes && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.observacoes}</p></CardContent>
          </Card>
        )}

        <PortalCard
          clientId={client.id}
          clienteNome={client.nome}
          clienteEmail={client.email ?? null}
        />
      </div>

      {showVincular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Vincular Consultor</h2>
              <button onClick={() => setShowVincular(false)}>
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>Consultor</Label>
              <Select
                value={selectedConsultorId}
                onChange={(e) => setSelectedConsultorId(e.target.value)}
                className="w-full"
              >
                <option value="">Sem consultor</option>
                {consultores?.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nome}</option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowVincular(false)}>Cancelar</Button>
              <Button
                size="sm"
                onClick={() => vincularMut.mutate(selectedConsultorId ? Number(selectedConsultorId) : null)}
                disabled={vincularMut.isPending}
              >
                {vincularMut.isPending ? 'Salvando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {client.loans && client.loans.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><CreditCard className="size-4" />Empréstimos de {client.nome}</CardTitle>
            <Link href={`/emprestimos/novo?clienteId=${client.id}`}>
              <Button size="sm" variant="outline">Novo empréstimo</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Contrato</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Valor</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Parcelas</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Início</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {client.loans.map((loan, idx) => {
                  const st = STATUS_LOAN[loan.status] ?? { label: loan.status, variant: 'outline' as const }
                  return (
                    <tr key={loan.id} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-medium">Contrato {idx + 1}</p>
                          <p className="text-xs text-muted-foreground">Empréstimo #{loan.id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(loan.valor)}</td>
                      <td className="px-4 py-2 text-center text-muted-foreground">{loan.numeroParcelas}x</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(loan.dataInicio)}</td>
                      <td className="px-4 py-2 text-center"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/emprestimos/${loan.id}`}>
                          <Button variant="ghost" size="sm">Ver</Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
