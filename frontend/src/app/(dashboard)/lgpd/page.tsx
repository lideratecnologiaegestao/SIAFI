'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, FileText, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/contexts/auth.context'
import { formatDateLocal } from '@/lib/utils'
import { toast } from 'sonner'
import api from '@/lib/api'

interface Solicitacao {
  id: number
  tipo: string
  status: string
  descricao: string
  resposta: string | null
  ip: string | null
  createdAt: string
  respondidoEm: string | null
  nomeRequerente: string
  emailRequerente: string
  client: { id: number; nome: string; email: string | null } | null
  respondente: { id: number; nome: string } | null
}

interface SolicitacoesResponse {
  data: Solicitacao[]
  total: number
  page: number
  lastPage: number
}

interface ConsentimentoRelatório {
  tipo: string
  aceitos: number
  revogados: number
}

const TIPO_LABEL: Record<string, string> = {
  acesso: 'Acesso',
  retificacao: 'Retificação',
  exclusao: 'Exclusão',
  portabilidade: 'Portabilidade',
  oposicao: 'Oposição',
  revogacao_consentimento: 'Revogação de Consentimento',
  informacao: 'Informação',
}

const TIPO_CONSENTIMENTO_LABEL: Record<string, string> = {
  termos_uso: 'Termos de Uso',
  politica_privacidade: 'Política de Privacidade',
  cookies_analiticos: 'Cookies Analíticos',
  marketing_whatsapp: 'Marketing WhatsApp',
  marketing_email: 'Marketing Email',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'outline'> = {
  aberto: 'default',
  em_analise: 'secondary',
  concluido: 'success',
  negado: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberta',
  em_analise: 'Em análise',
  concluido: 'Concluída',
  negado: 'Negada',
}

export default function LgpdPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin'

  const [statusFiltro, setStatusFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Solicitacao | null>(null)
  const [resposta, setResposta] = useState('')
  const [novoStatus, setNovoStatus] = useState<'concluido' | 'negado'>('concluido')
  const [anonConfirm, setAnonConfirm] = useState<Solicitacao | null>(null)
  const [anonNome, setAnonNome] = useState('')

  const { data, isLoading } = useQuery<SolicitacoesResponse>({
    queryKey: ['lgpd-solicitacoes', { statusFiltro, tipoFiltro, page }],
    queryFn: () =>
      api.get<SolicitacoesResponse>('/lgpd/solicitacoes', {
        params: {
          status: statusFiltro || undefined,
          tipo: tipoFiltro || undefined,
          page,
          limit: 20,
        },
      }).then(r => r.data),
  })

  const { data: relatorio } = useQuery<ConsentimentoRelatório[]>({
    queryKey: ['lgpd-relatorio'],
    queryFn: () => api.get<ConsentimentoRelatório[]>('/lgpd/relatorio-consentimentos').then(r => r.data),
    enabled: isAdmin,
  })

  const responderMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { resposta: string; status: 'concluido' | 'negado' } }) =>
      api.patch(`/lgpd/solicitacoes/${id}/responder`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lgpd-solicitacoes'] })
      setSelected(null)
      setResposta('')
      toast.success('Resposta registrada com sucesso')
    },
    onError: () => toast.error('Erro ao registrar resposta'),
  })

  const anonimizarMut = useMutation({
    mutationFn: (clientId: number) => api.post(`/lgpd/anonimizar/${clientId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lgpd-solicitacoes'] })
      setAnonConfirm(null)
      setAnonNome('')
      toast.success('Dados anonimizados com sucesso')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao anonimizar dados'),
  })

  const abertas = data?.data.filter(s => s.status === 'aberto').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LGPD — Conformidade</h1>
          <p className="text-muted-foreground text-sm mt-1">Solicitações de titulares e relatório de consentimentos</p>
        </div>
        {abertas > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="size-3" />{abertas} aberta{abertas !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Relatório de consentimentos */}
      {isAdmin && relatorio && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="size-4" />Relatório de Consentimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {relatorio.map((r) => (
                <div key={r.tipo} className="rounded-lg border bg-muted/20 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{TIPO_CONSENTIMENTO_LABEL[r.tipo] ?? r.tipo}</p>
                  <p className="text-lg font-bold text-green-600">{r.aceitos}</p>
                  <p className="text-xs text-muted-foreground">aceites</p>
                  {r.revogados > 0 && <p className="text-xs text-red-500 mt-0.5">{r.revogados} revogados</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentos vigentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />Documentos Vigentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 text-sm">
            {[
              { label: 'Termos de Uso', versao: '1.0', href: '/termos-de-uso' },
              { label: 'Política de Privacidade', versao: '1.0', href: '/politica-de-privacidade' },
              { label: 'Política de Cookies', versao: '1.0', href: '/politica-de-cookies' },
            ].map((doc) => (
              <a
                key={doc.href}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <FileText className="size-3.5 text-muted-foreground" />
                {doc.label} <Badge variant="outline" className="text-xs">v{doc.versao}</Badge>
              </a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Última revisão: 24/05/2026 · DPO: Bruno Anderson · privacidade@lidera.com.br</p>
        </CardContent>
      </Card>

      {/* Solicitações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" />Solicitações de Titulares
          </CardTitle>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Select value={statusFiltro} onChange={(e) => { setStatusFiltro(e.target.value); setPage(1) }} className="w-36">
              <option value="">Todos os status</option>
              <option value="aberto">Abertas</option>
              <option value="em_analise">Em análise</option>
              <option value="concluido">Concluídas</option>
              <option value="negado">Negadas</option>
            </Select>
            <Select value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setPage(1) }} className="w-44">
              <option value="">Todos os tipos</option>
              {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !data?.data.length ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="size-10 mx-auto text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Titular</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Data</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground">#{s.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.nomeRequerente}</p>
                      <p className="text-xs text-muted-foreground">{s.emailRequerente}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {TIPO_LABEL[s.tipo] ?? s.tipo}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_VARIANT[s.status] ?? 'outline'}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {formatDateLocal(s.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setSelected(s); setResposta(s.resposta ?? ''); setNovoStatus('concluido') }}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data && data.lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">{data.total} solicitações</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="flex items-center text-sm text-muted-foreground px-2">{page}/{data.lastPage}</span>
                <Button variant="outline" size="sm" disabled={page === data.lastPage} onClick={() => setPage(p => p + 1)}>Próximo</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal detalhe + resposta */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">Solicitação #{selected.id}</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Titular</p><p className="font-medium">{selected.nomeRequerente}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{selected.emailRequerente}</p></div>
                <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium">{TIPO_LABEL[selected.tipo] ?? selected.tipo}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={STATUS_VARIANT[selected.status] ?? 'outline'}>{STATUS_LABEL[selected.status] ?? selected.status}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Data</p><p>{formatDateLocal(selected.createdAt)}</p></div>
                {selected.client && <div><p className="text-xs text-muted-foreground">Cliente</p><p>{selected.client.nome} #{selected.client.id}</p></div>}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm bg-muted/30 rounded p-2 whitespace-pre-wrap">{selected.descricao}</p>
              </div>

              {selected.resposta && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resposta registrada</p>
                  <p className="text-sm bg-green-50 dark:bg-green-950/20 border border-green-200 rounded p-2 whitespace-pre-wrap">{selected.resposta}</p>
                  {selected.respondente && <p className="text-xs text-muted-foreground mt-1">Por {selected.respondente.nome} em {selected.respondidoEm ? formatDateLocal(selected.respondidoEm) : '—'}</p>}
                </div>
              )}

              {isAdmin && selected.status !== 'concluido' && selected.status !== 'negado' && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Resposta</Label>
                  <Textarea
                    rows={3}
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    placeholder="Escreva a resposta para o titular..."
                  />
                  <div className="space-y-1.5">
                    <Label>Encerrar como</Label>
                    <Select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as any)} className="w-full">
                      <option value="concluido">Concluída</option>
                      <option value="negado">Negada</option>
                    </Select>
                  </div>
                  <div className="flex justify-between gap-2">
                    {selected.tipo === 'exclusao' && selected.client && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => { setAnonConfirm(selected); setSelected(null) }}
                      >
                        Anonimizar dados
                      </Button>
                    )}
                    <Button
                      className="ml-auto"
                      disabled={!resposta.trim() || responderMut.isPending}
                      onClick={() => responderMut.mutate({ id: selected.id, body: { resposta, status: novoStatus } })}
                    >
                      {responderMut.isPending ? 'Salvando...' : 'Registrar resposta'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de anonimização */}
      {anonConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-destructive flex items-center gap-2">
              <XCircle className="size-4" />Anonimizar dados do cliente
            </h2>
            <p className="text-sm text-muted-foreground">
              Esta operação é <strong>irreversível</strong>. Os dados pessoais de{' '}
              <strong>{anonConfirm.client?.nome ?? anonConfirm.nomeRequerente}</strong> serão removidos
              permanentemente. Dados financeiros (contratos, pagamentos) serão mantidos por obrigação legal.
            </p>
            <div className="space-y-1.5">
              <Label>Digite o nome completo do cliente para confirmar</Label>
              <input
                type="text"
                value={anonNome}
                onChange={(e) => setAnonNome(e.target.value)}
                placeholder={anonConfirm.client?.nome ?? ''}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setAnonConfirm(null); setAnonNome('') }}>Cancelar</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  anonNome.trim().toLowerCase() !== (anonConfirm.client?.nome ?? '').toLowerCase() ||
                  anonimizarMut.isPending
                }
                onClick={() => anonConfirm.client && anonimizarMut.mutate(anonConfirm.client.id)}
              >
                {anonimizarMut.isPending ? 'Anonimizando...' : 'Confirmar anonimização'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
