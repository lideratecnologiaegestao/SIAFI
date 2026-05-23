'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'
import { portalClient } from '@/lib/portal/portal-client'

interface Pagamento {
  id: number
  valor: number
  dataPagamento: string
  metodoPagamento: string
  numeroParcela: number
  loanId: number
}

const METODOS: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  mercadopago: 'Mercado Pago',
}

function groupByMonth(pagamentos: Pagamento[]) {
  const groups: Record<string, Pagamento[]> = {}
  for (const p of pagamentos) {
    const key = p.dataPagamento.slice(0, 7) // YYYY-MM
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function PagamentosPage() {
  const { data, isLoading } = useQuery<Pagamento[]>({
    queryKey: ['portal-pagamentos'],
    queryFn: () => portalClient.get('/portal/pagamentos').then(r => r.data),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal">
          <button className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <h1 className="text-xl font-bold">Histórico de Pagamentos</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum pagamento registrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupByMonth(data).map(([key, items]) => (
            <div key={key}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 capitalize">
                {formatMonthLabel(key)}
              </p>
              <div className="space-y-2">
                {items.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-lg border px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-500 shrink-0" />
                      <div>
                        <p className="font-medium">Parcela {p.numeroParcela}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.dataPagamento)} · {METODOS[p.metodoPagamento] ?? p.metodoPagamento}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-green-700">{formatCurrency(p.valor)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
