'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate, STATUS_LOAN } from '@/lib/utils'
import { portalClient } from '@/lib/portal/portal-client'

interface Contrato {
  id: number
  valor: number
  numeroParcelas: number
  dataInicio: string
  status: string
  metodoPagamento: string
  percentualPago: number
  totalPago: number
  proximaParcela: { id: number; valor: number; dataVencimento: string } | null
}

export default function ContratosPage() {
  const { data, isLoading } = useQuery<Contrato[]>({
    queryKey: ['portal-contratos'],
    queryFn: () => portalClient.get('/portal/contratos').then(r => r.data),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal">
          <button className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <h1 className="text-xl font-bold">Meus Contratos</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum contrato encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((c, idx) => {
            const st = STATUS_LOAN[c.status] ?? { label: c.status, variant: 'outline' as const }
            return (
              <Link key={c.id} href={`/portal/contratos/${c.id}`}>
                <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Contrato {idx + 1}</p>
                        <p className="text-xs text-muted-foreground">Início: {formatDate(c.dataInicio)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Valor contratado</p>
                        <p className="font-medium">{formatCurrency(c.valor)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Parcelas</p>
                        <p className="font-medium">{c.numeroParcelas}x</p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{c.percentualPago}% pago</span>
                        <span>{formatCurrency(c.totalPago)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${c.percentualPago}%` }}
                        />
                      </div>
                    </div>

                    {c.proximaParcela && (
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                        <span className="text-muted-foreground text-xs">Próxima parcela: {formatDate(c.proximaParcela.dataVencimento)}</span>
                        <span className="font-medium text-xs">{formatCurrency(c.proximaParcela.valor)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
