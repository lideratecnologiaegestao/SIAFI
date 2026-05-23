'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, FileSignature, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, STATUS_LOAN } from '@/lib/utils'
import { portalClient } from '@/lib/portal/portal-client'

interface Parcela {
  id: number
  numero: number
  valor: number
  dataVencimento: string
  status: string
  dataPagamento: string | null
}

interface ContratoDetalhe {
  id: number
  valor: number
  numeroParcelas: number
  dataInicio: string
  status: string
  metodoPagamento: string
  aceiteExpiraEm: string | null
  totalParcelado: number
  totalPago: number
  saldoRestante: number
  parcelas: Parcela[]
}

const STATUS_PARCELA: Record<string, { label: string; variant: 'success' | 'outline' | 'destructive' | 'secondary' }> = {
  pago: { label: 'Pago', variant: 'success' },
  pendente: { label: 'Pendente', variant: 'outline' },
  atrasado: { label: 'Atrasado', variant: 'destructive' },
  cancelado: { label: 'Cancelado', variant: 'secondary' },
}

export default function ContratoDetalhePage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [aceiteConfirmado, setAceiteConfirmado] = useState(false)
  const [aceiteFeito, setAceiteFeito] = useState(false)

  const { data, isLoading } = useQuery<ContratoDetalhe>({
    queryKey: ['portal-contrato', id],
    queryFn: () => portalClient.get(`/portal/contratos/${id}`).then(r => r.data),
  })

  const aceitarMutation = useMutation({
    mutationFn: () => portalClient.patch(`/portal/contratos/${id}/aceitar`),
    onSuccess: () => {
      setAceiteFeito(true)
      queryClient.invalidateQueries({ queryKey: ['portal-contrato', id] })
      queryClient.invalidateQueries({ queryKey: ['portal-home'] })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data) return null

  const st = STATUS_LOAN[data.status] ?? { label: data.status, variant: 'outline' as const }
  const percent = data.totalParcelado > 0 ? Math.round((data.totalPago / data.totalParcelado) * 100) : 0
  const isAguardandoAceite = data.status === 'aguardando_aceite'
  const prazoExpirado = data.aceiteExpiraEm ? new Date(data.aceiteExpiraEm) < new Date() : false

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal/contratos">
          <button className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Contrato #{data.id}</h1>
          <p className="text-xs text-muted-foreground">Início: {formatDate(data.dataInicio)}</p>
        </div>
        <Badge variant={st.variant} className="ml-auto">{st.label}</Badge>
      </div>

      {/* Seção de aceite — visível apenas quando aguardando */}
      {isAguardandoAceite && !aceiteFeito && (
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardContent className="pt-4 pb-4 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-orange-900">
              <FileSignature className="size-5" />
              Proposta aguardando sua assinatura
            </div>

            {data.aceiteExpiraEm && (
              <div className={`flex items-center gap-1.5 text-xs ${prazoExpirado ? 'text-red-700' : 'text-orange-700'}`}>
                {prazoExpirado
                  ? <><AlertTriangle className="size-3.5" />Prazo expirado em {formatDate(data.aceiteExpiraEm)}</>
                  : <><Clock className="size-3.5" />Prazo para aceite: {formatDate(data.aceiteExpiraEm)}</>
                }
              </div>
            )}

            <div className="bg-white rounded-lg border px-4 py-3 space-y-2 text-sm">
              <p className="font-medium">Resumo da proposta</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Capital liberado</p>
                  <p className="font-semibold">{formatCurrency(data.valor)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total a pagar</p>
                  <p className="font-semibold">{formatCurrency(data.totalParcelado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Parcelas</p>
                  <p className="font-semibold">{data.numeroParcelas}x de {formatCurrency(data.totalParcelado / data.numeroParcelas)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Início previsto</p>
                  <p className="font-semibold">{formatDate(data.dataInicio)}</p>
                </div>
              </div>
            </div>

            {prazoExpirado ? (
              <p className="text-sm text-red-700 text-center">
                O prazo para aceite desta proposta expirou. Entre em contato com seu consultor.
              </p>
            ) : (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-gray-300"
                    checked={aceiteConfirmado}
                    onChange={e => setAceiteConfirmado(e.target.checked)}
                  />
                  <span className="text-sm text-orange-900 leading-snug">
                    Li e concordo com os termos desta proposta. Estou ciente do valor, das parcelas e das condições descritas acima.
                  </span>
                </label>

                {aceitarMutation.isError && (
                  <p className="text-sm text-destructive">
                    {(aceitarMutation.error as any)?.response?.data?.message ?? 'Erro ao registrar aceite. Tente novamente.'}
                  </p>
                )}

                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white h-10"
                  disabled={!aceiteConfirmado || aceitarMutation.isPending}
                  onClick={() => aceitarMutation.mutate()}
                >
                  {aceitarMutation.isPending ? 'Registrando...' : 'Assinar e aceitar proposta'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aceite registrado com sucesso */}
      {aceiteFeito && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle2 className="size-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Proposta aceita com sucesso!</p>
              <p className="text-sm text-green-800">Aguarde a confirmação da liberação do capital pelo financeiro.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Valor contratado</p>
              <p className="font-semibold">{formatCurrency(data.valor)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total parcelado</p>
              <p className="font-semibold">{formatCurrency(data.totalParcelado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total pago</p>
              <p className="font-semibold text-green-700">{formatCurrency(data.totalPago)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo restante</p>
              <p className="font-semibold text-amber-700">{formatCurrency(data.saldoRestante)}</p>
            </div>
          </div>

          {!isAguardandoAceite && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{percent}% pago</span>
                <span>{data.parcelas.filter(p => p.status === 'pago').length} de {data.numeroParcelas} parcelas</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {isAguardandoAceite ? 'Parcelas previstas' : 'Parcelas'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {data.parcelas.map(p => {
              const sp = STATUS_PARCELA[p.status] ?? { label: p.status, variant: 'outline' as const }
              const isPendente = p.status === 'pendente' || p.status === 'atrasado'
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">Parcela {p.numero}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.dataPagamento ? `Pago em ${formatDate(p.dataPagamento)}` : `Vence ${formatDate(p.dataVencimento)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{formatCurrency(p.valor)}</p>
                    {isAguardandoAceite ? (
                      <Badge variant="secondary">Prevista</Badge>
                    ) : isPendente ? (
                      <Link href={`/portal/pagamentos/pix/${p.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <CreditCard className="size-3" />PIX
                        </Button>
                      </Link>
                    ) : (
                      <Badge variant={sp.variant}>{sp.label}</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
