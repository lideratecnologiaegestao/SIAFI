'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Lock, Unlock, AlertTriangle, CheckCircle, KeyRound, X, ShieldCheck, ShieldOff } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

interface PortalStatus {
  temEmail: boolean
  portalAtivo: boolean
  portalAtivadoEm: string | null
  ultimoAcessoPortal: string | null
  mfaEnabled: boolean
  mfaLoginsRestantes: number
  senhaTemporaria: boolean
  primeiroAcesso: boolean
  temContaSupabase: boolean
}

interface PortalCardProps {
  clientId: number
  clienteNome: string
  clienteEmail: string | null
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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

export function PortalCard({ clientId, clienteNome, clienteEmail }: PortalCardProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const canManage = user?.role === 'admin' || user?.role === 'financeiro' || user?.role === 'consultor'
  const canDeactivate = user?.role === 'admin' || user?.role === 'financeiro'

  const [showAtivar, setShowAtivar] = useState(false)
  const [showDesativar, setShowDesativar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [senhaExibida, setSenhaExibida] = useState<string | null>(null)

  const { data: status, isLoading } = useQuery<PortalStatus>({
    queryKey: ['portal-status', clientId],
    queryFn: () => api.get(`/clients/${clientId}/portal/status`).then(r => r.data),
    enabled: canManage,
  })

  const ativarMutation = useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/portal/ativar`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['portal-status', clientId] })
      setShowAtivar(false)
      if (res.data.senhaTemporaria) setSenhaExibida(res.data.senhaTemporaria)
    },
  })

  const reativarMutation = useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/portal/reativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-status', clientId] }),
  })

  const desativarMutation = useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/portal/desativar`, { motivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-status', clientId] })
      setShowDesativar(false)
      setMotivo('')
    },
  })

  const reenviarMutation = useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/portal/reenviar-senha`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-status', clientId] }),
  })

  if (!canManage) return null

  if (isLoading) return <Skeleton className="h-32 md:col-span-2" />

  const s = status

  // Estado 1 — sem email
  if (s && !s.temEmail) {
    return (
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="size-4" />Portal do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Sem email cadastrado</p>
              <p className="text-xs">Adicione um email ao cadastro para poder ativar o acesso ao portal.</p>
            </div>
          </div>
          <Link href={`/clientes/${clientId}/editar`}>
            <Button variant="outline" size="sm">Editar cadastro</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  // Estado 4 — desativado (tinha conta mas agora está inativo)
  if (s && !s.portalAtivo && s.temContaSupabase) {
    return (
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="size-4" />Portal do Cliente
          </CardTitle>
          <Badge variant="secondary">Desativado</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">O acesso ao portal foi desativado.</p>
          {canDeactivate && (
            <Button
              size="sm"
              onClick={() => reativarMutation.mutate()}
              disabled={reativarMutation.isPending}
            >
              <CheckCircle className="size-3.5 mr-1.5" />
              {reativarMutation.isPending ? 'Reativando...' : 'Reativar acesso'}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Estado 3 — ativo
  if (s && s.portalAtivo) {
    return (
      <>
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Unlock className="size-4 text-green-600" />Portal do Cliente
            </CardTitle>
            <Badge variant="success" className="gap-1">
              <CheckCircle className="size-3" />Ativo
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="font-medium">{clienteEmail}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Ativado em</p>
                <p className="font-medium">{formatDate(s.portalAtivadoEm)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Último acesso</p>
                <p className="font-medium">{formatDate(s.ultimoAcessoPortal)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">MFA</p>
                <p className="font-medium">
                  {s.mfaEnabled
                    ? <span className="text-green-600 flex items-center gap-1"><ShieldCheck className="size-3" />Configurado</span>
                    : <span className="text-amber-600">⚠️ Não configurado ({s.mfaLoginsRestantes} de 5 restantes)</span>
                  }
                </p>
              </div>
            </div>
            {(s.senhaTemporaria || s.primeiroAcesso) && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠️ Cliente ainda não trocou a senha temporária
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => reenviarMutation.mutate()}
                disabled={reenviarMutation.isPending}
              >
                <KeyRound className="size-3.5 mr-1.5" />
                {reenviarMutation.isPending ? 'Enviando...' : 'Reenviar senha'}
              </Button>
              {canDeactivate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDesativar(true)}
                >
                  <ShieldOff className="size-3.5 mr-1.5" />
                  Desativar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal desativar */}
        {showDesativar && (
          <Modal title="⚠️ Desativar acesso ao portal" onClose={() => setShowDesativar(false)}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>{clienteNome}</strong> perderá o acesso imediatamente. Histórico e dados serão mantidos.
              </p>
              <div className="space-y-1.5">
                <Label>Motivo (obrigatório)</Label>
                <Textarea
                  rows={3}
                  placeholder="Informe o motivo da desativação..."
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDesativar(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  disabled={!motivo.trim() || desativarMutation.isPending}
                  onClick={() => desativarMutation.mutate()}
                >
                  {desativarMutation.isPending ? 'Desativando...' : 'Confirmar desativação'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal senha exibida */}
        {senhaExibida && (
          <Modal title="Portal reativado!" onClose={() => setSenhaExibida(null)}>
            <div className="space-y-3 text-sm">
              <p>Nova senha temporária enviada ao cliente. Também exibida aqui para garantia:</p>
              <div className="rounded-lg bg-slate-50 border px-4 py-3 text-center">
                <p className="font-mono text-lg font-semibold tracking-widest">{senhaExibida}</p>
              </div>
              <p className="text-xs text-muted-foreground">Esta senha não será exibida novamente. Envie ao cliente se necessário.</p>
              <Button className="w-full" onClick={() => setSenhaExibida(null)}>Fechar</Button>
            </div>
          </Modal>
        )}
      </>
    )
  }

  // Estado 2 — inativo (nunca ativou)
  return (
    <>
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="size-4" />Portal do Cliente
          </CardTitle>
          <Badge variant="secondary">Inativo</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-1">
            {clienteEmail && <p><span className="text-muted-foreground">Email: </span><span className="font-medium">{clienteEmail}</span></p>}
          </div>
          <p className="text-sm text-muted-foreground">O cliente ainda não possui acesso ao portal.</p>
          <Button size="sm" onClick={() => setShowAtivar(true)}>
            <CheckCircle className="size-3.5 mr-1.5" />
            Ativar acesso ao portal
          </Button>
        </CardContent>
      </Card>

      {/* Modal ativar */}
      {showAtivar && (
        <Modal title="Ativar Portal do Cliente" onClose={() => setShowAtivar(false)}>
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p>Você está prestes a criar acesso para:</p>
              <div className="rounded-lg bg-slate-50 border p-3 space-y-1">
                <p className="font-medium">👤 {clienteNome}</p>
                {clienteEmail && <p>📧 {clienteEmail}</p>}
              </div>
              <p className="text-muted-foreground">O cliente receberá uma senha temporária via WhatsApp e email.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAtivar(false)}>Cancelar</Button>
              <Button
                onClick={() => ativarMutation.mutate()}
                disabled={ativarMutation.isPending}
              >
                {ativarMutation.isPending ? 'Ativando...' : '✅ Confirmar ativação'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal senha exibida */}
      {senhaExibida && (
        <Modal title="Portal ativado com sucesso! 🎉" onClose={() => setSenhaExibida(null)}>
          <div className="space-y-3 text-sm">
            <p>Senha temporária gerada. Também disponível aqui por segurança:</p>
            <div className="rounded-lg bg-slate-50 border px-4 py-3 text-center">
              <p className="font-mono text-lg font-semibold tracking-widest">{senhaExibida}</p>
            </div>
            <p className="text-xs text-muted-foreground">Esta senha não será exibida novamente.</p>
            <Button className="w-full" onClick={() => setSenhaExibida(null)}>Fechar</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
