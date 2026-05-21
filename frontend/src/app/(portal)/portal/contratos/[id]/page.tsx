'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, STATUS_LOAN } from '@/lib/utils'
import api from '@/lib/api'

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

  const { data, isLoading } = useQuery<ContratoDetalhe>({
    queryKey: ['portal-contrato', id],
    queryFn: () => api.get(`/portal/contratos/${id}`).then(r => r.data),
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

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{percent}% pago</span>
              <span>{data.parcelas.filter(p => p.status === 'pago').length} de {data.numeroParcelas} parcelas</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Parcelas</CardTitle>
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
                    {isPendente ? (
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
