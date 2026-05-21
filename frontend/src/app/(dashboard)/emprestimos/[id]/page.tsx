'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, XCircle, RefreshCcw, QrCode, DollarSign, FileDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate, STATUS_LOAN, STATUS_INSTALLMENT, METODO_PAGAMENTO } from '@/lib/utils'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'

interface Installment {
  id: number; numero: number; installmentAmount: number; dataVencimento: string
  status: string; totalPago: number; principalPayback: number; netGain: number
  saldoDevedor: number; moraAcumulada: number
  cobrancaEnviadaEm?: string | null
  cobrancaWhatsappOk: boolean; cobrancaEmailOk: boolean; cobrancaPortalOk: boolean
  multaAplicada: number; valorComEncargos?: number | null
}
interface Loan {
  id: number; principalAmount: number; targetProfit: number; totalReceivable: number
  taxaJuros: number | null; modoTaxa: string | null
  numeroParcelas: number; dataInicio: string; status: string
  observacoes?: string | null; metodoPagamento?: string | null
  client: { id: number; nome: string; cpf: string }
  installments: Installment[]
  consultor?: { id: number; nome: string } | null
}

export default function EmprestimoDetalhePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [payInstallmentId, setPayInstallmentId] = useState<number | null>(null)
  const [valorPago, setValorPago] = useState('')
  const [metodo, setMetodo] = useState('dinheiro')
  const [activeTab, setActiveTab] = useState<'parcelas' | 'cobrancas'>('parcelas')

  const canSeeSplit = user?.role === 'admin' || user?.role === 'financeiro' || user?.role === 'consultor'

  const { data: loan, isLoading, isError } = useQuery({
    queryKey: ['loans', id],
    queryFn: () => api.get<Loan>(`/loans/${id}`).then((r) => r.data),
  })

  const cancelMut = useMutation({
    mutationFn: () => api.patch(`/loans/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans', id] }),
  })

  const payMut = useMutation({
    mutationFn: (data: { installmentId: number; valorPago: number; metodoPagamento: string; dataPagamento: string }) =>
      api.post('/payments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans', id] })
      setPayInstallmentId(null)
      setValorPago('')
    },
  })

  async function baixarContrato() {
    const res = await api.get(`/export/contratos/${id}/pdf`, { responseType: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }))
    a.download = `contrato-${id}.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function handlePay(inst: Installment) {
    setPayInstallmentId(inst.id)
    // Pré-preenche com saldo devedor + mora acumulada (total para quitar)
    const totalParaQuitar = Number(inst.saldoDevedor) + Number(inst.moraAcumulada)
    setValorPago(totalParaQuitar.toFixed(2))
  }

  function submitPay() {
    if (!payInstallmentId || !valorPago) return
    payMut.mutate({
      installmentId: payInstallmentId,
      valorPago: Number(valorPago),
      metodoPagamento: metodo,
      dataPagamento: new Date().toISOString().split('T')[0],
    })
  }

  if (isLoading) return (
    <div className="space-y-4 max-w-4xl">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" />
    </div>
  )
  if (isError || !loan) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Empréstimo não encontrado.</p>
      <Link href="/emprestimos"><Button variant="outline" className="mt-4">Voltar</Button></Link>
    </div>
  )

  const st = STATUS_LOAN[loan.status] ?? { label: loan.status, variant: 'outline' as const }
  const totalPago = loan.installments.reduce((s, i) => s + Number(i.totalPago), 0)
  const pendente = Number(loan.totalReceivable) - totalPago
  const margemPct = Number(loan.principalAmount) > 0
    ? ((Number(loan.targetProfit) / Number(loan.principalAmount)) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/emprestimos"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Empréstimo #{loan.id}</h1>
            <p className="text-muted-foreground text-sm">
              <Link href={`/clientes/${loan.client?.id}`} className="hover:underline">{loan.client?.nome}</Link>
              {' · '}Início em {formatDate(loan.dataInicio)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={st.variant}>{st.label}</Badge>
          <Button size="sm" variant="outline" className="gap-1" onClick={baixarContrato}>
            <FileDown className="size-3.5" />PDF
          </Button>
          {loan.status === 'ativo' && (
            <>
              <Link href={`/renegociacoes/nova?loanId=${loan.id}`}>
                <Button size="sm" variant="outline" className="gap-1"><RefreshCcw className="size-3.5" />Renegociar</Button>
              </Link>
              <Button size="sm" variant="destructive" className="gap-1"
                onClick={() => { if (confirm('Cancelar empréstimo?')) cancelMut.mutate() }}
                disabled={cancelMut.isPending}>
                <XCircle className="size-3.5" />Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Capital Emprestado', value: formatCurrency(Number(loan.principalAmount)), color: 'text-foreground' },
          { label: 'Total a Receber', value: formatCurrency(Number(loan.totalReceivable)), color: 'text-blue-700 dark:text-blue-400' },
          { label: 'Total Pago', value: formatCurrency(totalPago), color: 'text-green-600' },
          { label: 'Pendente', value: formatCurrency(Math.max(0, pendente)), color: pendente > 0 ? 'text-red-600' : 'text-green-600' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Informações do Contrato</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Parcelas</p>
            <p className="font-medium">{loan.numeroParcelas}x de {formatCurrency(Number(loan.totalReceivable) / loan.numeroParcelas)}</p>
          </div>
          <div><p className="text-muted-foreground">Data de Início</p><p className="font-medium">{formatDate(loan.dataInicio)}</p></div>
          {loan.metodoPagamento && (
            <div>
              <p className="text-muted-foreground">Pagamento</p>
              <p className="font-medium">{METODO_PAGAMENTO[loan.metodoPagamento] ?? loan.metodoPagamento}</p>
            </div>
          )}
          <div><p className="text-muted-foreground">Status</p><Badge variant={st.variant}>{st.label}</Badge></div>
          {loan.observacoes && (
            <div className="col-span-full">
              <p className="text-muted-foreground">Observações</p>
              <p className="font-medium">{loan.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canSeeSplit && (
        <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <TrendingUp className="size-4" />Split do Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Capital Emprestado</p>
              <p className="font-bold text-base">{formatCurrency(Number(loan.principalAmount))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Lucro Alvo</p>
              <p className="font-bold text-base text-orange-600">{formatCurrency(Number(loan.targetProfit))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total a Receber</p>
              <p className="font-bold text-base text-blue-700 dark:text-blue-400">{formatCurrency(Number(loan.totalReceivable))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Margem sobre Capital</p>
              <p className="font-bold text-base text-indigo-700 dark:text-indigo-400">{margemPct}%</p>
            </div>
            {loan.consultor && (
              <div>
                <p className="text-muted-foreground">Consultor</p>
                <p className="font-medium">{loan.consultor.nome}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-0">
          <div className="flex gap-1 border-b border-border pb-0 -mb-px">
            {(['parcelas', 'cobrancas'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'parcelas' ? 'Parcelas' : 'Cobranças'}
              </button>
            ))}
          </div>
        </CardHeader>

        {activeTab === 'cobrancas' && (
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Enviada em</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">WA</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Email</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Portal</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Multa</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Com encargos</th>
                </tr>
              </thead>
              <tbody>
                {loan.installments.map((inst) => (
                  <tr key={inst.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground">{inst.numero}</td>
                    <td className="px-4 py-2">{formatDate(inst.dataVencimento)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {inst.cobrancaEnviadaEm ? formatDate(inst.cobrancaEnviadaEm) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center">{inst.cobrancaWhatsappOk ? '✅' : '—'}</td>
                    <td className="px-4 py-2 text-center">{inst.cobrancaEmailOk ? '✅' : '—'}</td>
                    <td className="px-4 py-2 text-center">{inst.cobrancaPortalOk ? '✅' : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {Number(inst.multaAplicada) > 0
                        ? <span className="text-orange-600">{formatCurrency(Number(inst.multaAplicada))}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {inst.valorComEncargos
                        ? <span className="font-medium">{formatCurrency(Number(inst.valorComEncargos))}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}

        {activeTab === 'parcelas' && <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                {canSeeSplit && <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Capital</th>}
                {canSeeSplit && <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Lucro</th>}
                <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Pago</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Saldo</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Mora</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loan.installments.map((inst) => {
                const ist = STATUS_INSTALLMENT[inst.status] ?? { label: inst.status, variant: 'outline' as const }
                const isParcial = inst.status === 'parcialmente_pago'
                const canPay = inst.status === 'pendente' || inst.status === 'atrasado' || isParcial
                return (
                  <tr key={inst.id} className={`border-b border-border hover:bg-muted/20 ${isParcial ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                    <td className="px-4 py-2 text-muted-foreground">{inst.numero}</td>
                    <td className="px-4 py-2">{formatDate(inst.dataVencimento)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(inst.installmentAmount))}</td>
                    {canSeeSplit && (
                      <td className="px-4 py-2 text-right text-blue-700 dark:text-blue-400 hidden lg:table-cell">
                        {formatCurrency(Number(inst.principalPayback))}
                      </td>
                    )}
                    {canSeeSplit && (
                      <td className="px-4 py-2 text-right text-orange-600 hidden lg:table-cell">
                        {formatCurrency(Number(inst.netGain))}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right text-green-600 hidden md:table-cell">
                      {Number(inst.totalPago) > 0 ? formatCurrency(Number(inst.totalPago)) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right hidden md:table-cell">
                      {Number(inst.saldoDevedor) > 0
                        ? <span className="text-red-600 font-medium">{formatCurrency(Number(inst.saldoDevedor))}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right hidden lg:table-cell">
                      {Number(inst.moraAcumulada) > 0
                        ? <span className="text-orange-600 text-xs">{formatCurrency(Number(inst.moraAcumulada))}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center"><Badge variant={ist.variant}>{ist.label}</Badge></td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {canPay && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                              onClick={() => handlePay(inst)}>
                              <DollarSign className="size-3" />{isParcial ? 'Complementar' : 'Pagar'}
                            </Button>
                            {!isParcial && (
                              <Link href={`/pix?parcelaId=${inst.id}`}>
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                  <QrCode className="size-3" />PIX
                                </Button>
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>}
      </Card>

      {payInstallmentId && (() => {
        const instSelecionada = loan.installments.find(i => i.id === payInstallmentId)
        return (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
            <CardHeader>
              <CardTitle className="text-base text-green-700 dark:text-green-400">
                Registrar Pagamento — Parcela #{instSelecionada?.numero}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {instSelecionada && instSelecionada.status === 'parcialmente_pago' && (
                <div className="rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex gap-4">
                  <span>Pago: <strong>{formatCurrency(Number(instSelecionada.totalPago))}</strong></span>
                  <span>Saldo: <strong>{formatCurrency(Number(instSelecionada.saldoDevedor))}</strong></span>
                  {Number(instSelecionada.moraAcumulada) > 0 && (
                    <span>Mora: <strong>{formatCurrency(Number(instSelecionada.moraAcumulada))}</strong></span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Valor Pago (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
                  {instSelecionada && Number(instSelecionada.saldoDevedor) > 0 && (
                    <p className="text-[10px] text-muted-foreground">Pré-preenchido com saldo + mora para quitação total</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Método de Pagamento</Label>
                  <Select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                    {Object.entries(METODO_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={submitPay} disabled={payMut.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                    <DollarSign className="size-4" />{payMut.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
                  </Button>
                  <Button variant="outline" onClick={() => setPayInstallmentId(null)}>Cancelar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
