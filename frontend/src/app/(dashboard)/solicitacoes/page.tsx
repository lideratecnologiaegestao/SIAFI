'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, CheckCircle, XCircle, Clock, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

interface Solicitacao {
  id: number
  tipo: string
  descricao: string
  status: string
  valorSolicitado: number | null
  respostaFinanceiro: string | null
  createdAt: string
  consultor: { nome: string }
  client: { nome: string; cpf: string | null }
}

interface ClienteCarteira {
  id: number
  nome: string
}

const criarSchema = z.object({
  clientId: z.coerce.number().int().positive('Selecione um cliente'),
  tipo: z.enum(['desconto', 'reparcelamento', 'intencao_emprestimo', 'outro']),
  descricao: z.string().min(5, 'Descreva a solicitação'),
  valorSolicitado: z.string().optional(),
})

const responderSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado']),
  respostaFinanceiro: z.string().optional(),
})

type CriarForm = z.infer<typeof criarSchema>
type ResponderForm = z.infer<typeof responderSchema>

const statusBadge = {
  pendente: { label: 'Pendente', variant: 'secondary' as const, Icon: Clock },
  aprovado: { label: 'Aprovado', variant: 'default' as const, Icon: CheckCircle },
  rejeitado: { label: 'Rejeitado', variant: 'destructive' as const, Icon: XCircle },
}

const tipoLabel: Record<string, string> = {
  desconto: 'Desconto',
  reparcelamento: 'Reparcelamento',
  intencao_emprestimo: 'Intenção de Empréstimo',
  outro: 'Outro',
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR')
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export default function SolicitacoesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isConsultor = user?.role === 'consultor'
  const canResponder = user?.role === 'admin' || user?.role === 'financeiro'

  const [filterStatus, setFilterStatus] = useState('all')
  const [showCriar, setShowCriar] = useState(false)
  const [respondendo, setRespondendo] = useState<Solicitacao | null>(null)

  const { data, isLoading } = useQuery<Solicitacao[]>({
    queryKey: ['solicitacoes', filterStatus],
    queryFn: () =>
      api.get('/solicitacoes', { params: filterStatus !== 'all' ? { status: filterStatus } : {} })
        .then(r => r.data),
  })

  const { data: clientes } = useQuery<ClienteCarteira[]>({
    queryKey: ['consultor-carteira'],
    queryFn: () => api.get('/consultor/carteira').then(r => r.data),
    enabled: isConsultor,
  })

  const criarForm = useForm<CriarForm>({
    resolver: zodResolver(criarSchema) as any,
    defaultValues: { tipo: 'outro', descricao: '' },
  })

  const responderForm = useForm<ResponderForm>({
    resolver: zodResolver(responderSchema) as any,
    defaultValues: { status: 'aprovado' },
  })

  const criarMutation = useMutation({
    mutationFn: (dto: CriarForm) =>
      api.post('/solicitacoes', {
        clientId: dto.clientId,
        tipo: dto.tipo,
        descricao: dto.descricao,
        valorSolicitado: dto.valorSolicitado ? Number(dto.valorSolicitado) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes'] })
      setShowCriar(false)
      criarForm.reset()
    },
  })

  const responderMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: ResponderForm }) =>
      api.patch(`/solicitacoes/${id}/responder`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes'] })
      setRespondendo(null)
      responderForm.reset()
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitações</h1>
          <p className="text-muted-foreground text-sm">
            {isConsultor
              ? 'Solicite descontos, reparcelamentos e outros pedidos ao financeiro.'
              : 'Solicitações dos consultores aguardando aprovação.'}
          </p>
        </div>
        {isConsultor && (
          <Button onClick={() => setShowCriar(true)}>
            <Plus className="size-4 mr-2" />
            Nova Solicitação
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="w-44"
        >
          <option value="all">Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="aprovado">Aprovados</option>
          <option value="rejeitado">Rejeitados</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <ClipboardList className="size-8 mb-2 opacity-40" />
            <p>Nenhuma solicitação encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map(sol => {
            const badge = statusBadge[sol.status as keyof typeof statusBadge] ?? statusBadge.pendente
            return (
              <Card key={sol.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={badge.variant} className="gap-1 text-xs">
                          <badge.Icon className="size-3" />
                          {badge.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{tipoLabel[sol.tipo] ?? sol.tipo}</Badge>
                        {sol.valorSolicitado != null && (
                          <span className="text-xs text-muted-foreground">{formatCurrency(sol.valorSolicitado)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{sol.client.nome}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{sol.descricao}</p>
                      {sol.respostaFinanceiro && (
                        <p className="text-sm text-slate-600 mt-1 italic">Resp.: {sol.respostaFinanceiro}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Por {sol.consultor.nome} · {formatDate(sol.createdAt)}
                      </p>
                    </div>
                    {canResponder && sol.status === 'pendente' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRespondendo(sol)
                          responderForm.reset({ status: 'aprovado' })
                        }}
                      >
                        Responder
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal: Nova Solicitação */}
      {showCriar && (
        <Modal title="Nova Solicitação" onClose={() => setShowCriar(false)}>
          <form
            onSubmit={criarForm.handleSubmit(dto => criarMutation.mutate(dto))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select {...criarForm.register('clientId')}>
                <option value="">Selecione o cliente</option>
                {clientes?.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
              {criarForm.formState.errors.clientId && (
                <p className="text-xs text-destructive">{criarForm.formState.errors.clientId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select {...criarForm.register('tipo')}>
                <option value="desconto">Desconto</option>
                <option value="reparcelamento">Reparcelamento</option>
                <option value="intencao_emprestimo">Intenção de Empréstimo</option>
                <option value="outro">Outro</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea placeholder="Descreva o pedido..." rows={3} {...criarForm.register('descricao')} />
              {criarForm.formState.errors.descricao && (
                <p className="text-xs text-destructive">{criarForm.formState.errors.descricao.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Valor solicitado (opcional)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...criarForm.register('valorSolicitado')} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCriar(false)}>Cancelar</Button>
              <Button type="submit" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Responder */}
      {respondendo && (
        <Modal title="Responder Solicitação" onClose={() => setRespondendo(null)}>
          <form
            onSubmit={responderForm.handleSubmit(dto =>
              responderMutation.mutate({ id: respondendo.id, dto })
            )}
            className="space-y-4"
          >
            <div className="rounded-lg bg-slate-50 border p-3 text-sm">
              <p className="font-medium">{respondendo.client.nome}</p>
              <p className="text-muted-foreground">{respondendo.descricao}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Decisão</Label>
              <Select {...responderForm.register('status')}>
                <option value="aprovado">Aprovar</option>
                <option value="rejeitado">Rejeitar</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Resposta (opcional)</Label>
              <Textarea placeholder="Mensagem para o consultor..." rows={2} {...responderForm.register('respostaFinanceiro')} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRespondendo(null)}>Cancelar</Button>
              <Button type="submit" disabled={responderMutation.isPending}>
                {responderMutation.isPending ? 'Salvando...' : 'Confirmar'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
