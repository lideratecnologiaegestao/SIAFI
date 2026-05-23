'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertTriangle, Clock, CreditCard, CheckCircle, ChevronRight, ShieldAlert, FileSignature } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { portalClient } from '@/lib/portal/portal-client'

interface Alerta {
  tipo: 'atrasado' | 'vencendo' | 'mfa'
  mensagem: string
  loanId?: number
}

interface Pagamento {
  id: number
  valor: number
  dataPagamento: string
  numeroParcela: number
  loanId: number
  metodoPagamento: string
}

interface ContratoPendenteAceite {
  id: number
  valor: number
  numeroParcelas: number
  aceiteExpiraEm: string | null
}

interface HomeData {
  contratosAtivos: number
  contratosPendentesAceite: ContratoPendenteAceite[]
  proximaParcela: { valor: number; dataVencimento: string; installmentId: number } | null
  totalEmAberto: number
  ultimosPagamentos: Pagamento[]
  alerta: Alerta | null
}

const METODOS: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  mercadopago: 'Mercado Pago',
}

export default function PortalHomePage() {
  const { data, isLoading } = useQuery<HomeData>({
    queryKey: ['portal-home'],
    queryFn: () => portalClient.get('/portal/home').then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const d = data

  return (
    <div className="space-y-5">
      {/* Contratos aguardando aceite — ação urgente */}
      {d?.contratosPendentesAceite?.map(c => (
        <div key={c.id} className="rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-orange-900 text-sm">
            <FileSignature className="size-4 shrink-0" />
            Proposta aguardando sua assinatura
          </div>
          <div className="text-sm text-orange-800 space-y-0.5">
            <p>Valor: <span className="font-medium">{formatCurrency(c.valor)}</span> · {c.numeroParcelas} parcelas</p>
            {c.aceiteExpiraEm && (
              <p className="text-xs">Prazo para aceite: {formatDate(c.aceiteExpiraEm)}</p>
            )}
          </div>
          <Link href={`/portal/contratos/${c.id}`}>
            <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white h-9 text-sm">
              Ver proposta e assinar
            </Button>
          </Link>
        </div>
      ))}

      {/* Alerta */}
      {d?.alerta && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 text-sm ${
          d.alerta.tipo === 'atrasado'
            ? 'bg-red-50 border-red-200 text-red-800'
            : d.alerta.tipo === 'vencendo'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {d.alerta.tipo === 'atrasado' ? <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            : d.alerta.tipo === 'vencendo' ? <Clock className="size-4 mt-0.5 shrink-0" />
            : <ShieldAlert className="size-4 mt-0.5 shrink-0" />}
          <div className="flex-1">
            <p>{d.alerta.mensagem}</p>
            {d.alerta.loanId && (
              <Link href={`/portal/contratos/${d.alerta.loanId}`} className="text-xs font-medium underline mt-1 block">
                Ver contrato
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 space-y-1">
            <p className="text-xs text-muted-foreground">Contratos ativos</p>
            <p className="text-2xl font-bold">{d?.contratosAtivos ?? '—'}</p>
            <Link href="/portal/contratos" className="text-xs text-blue-600 flex items-center gap-0.5">
              Ver contratos <ChevronRight className="size-3" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total em aberto</p>
            <p className="text-2xl font-bold">{d ? formatCurrency(d.totalEmAberto) : '—'}</p>
            <Link href="/portal/pagamentos" className="text-xs text-blue-600 flex items-center gap-0.5">
              Histórico <ChevronRight className="size-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Próxima parcela */}
      {d?.proximaParcela && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Próxima parcela</p>
                <p className="text-xl font-bold">{formatCurrency(d.proximaParcela.valor)}</p>
                <p className="text-sm text-muted-foreground">Vence em {formatDate(d.proximaParcela.dataVencimento)}</p>
              </div>
              <Link href={`/portal/pagamentos/pix/${d.proximaParcela.installmentId}`}>
                <Button size="sm" className="gap-1.5">
                  <CreditCard className="size-3.5" />
                  Pagar via PIX
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimos pagamentos */}
      {d?.ultimosPagamentos && d.ultimosPagamentos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Últimos pagamentos</h2>
            <Link href="/portal/pagamentos" className="text-xs text-blue-600">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {d.ultimosPagamentos.map(p => (
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
      )}

      {/* Navegação rápida */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link href="/portal/contratos">
          <button className="w-full text-left bg-white rounded-xl border px-4 py-3 hover:bg-muted/30 transition-colors">
            <p className="font-medium text-sm">Meus Contratos</p>
            <p className="text-xs text-muted-foreground mt-0.5">Parcelas e status</p>
          </button>
        </Link>
        <Link href="/portal/suporte">
          <button className="w-full text-left bg-white rounded-xl border px-4 py-3 hover:bg-muted/30 transition-colors">
            <p className="font-medium text-sm">Suporte</p>
            <p className="text-xs text-muted-foreground mt-0.5">Abrir chamado</p>
          </button>
        </Link>
        <Link href="/portal/perfil">
          <button className="w-full text-left bg-white rounded-xl border px-4 py-3 hover:bg-muted/30 transition-colors">
            <p className="font-medium text-sm">Meu Perfil</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dados e segurança</p>
          </button>
        </Link>
        <Link href="/portal/pagamentos">
          <button className="w-full text-left bg-white rounded-xl border px-4 py-3 hover:bg-muted/30 transition-colors">
            <p className="font-medium text-sm">Pagamentos</p>
            <p className="text-xs text-muted-foreground mt-0.5">Histórico completo</p>
          </button>
        </Link>
      </div>
    </div>
  )
}
