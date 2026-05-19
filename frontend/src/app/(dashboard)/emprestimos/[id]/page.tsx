'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, XCircle, RefreshCcw, QrCode, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate, STATUS_LOAN, STATUS_INSTALLMENT, METODO_PAGAMENTO } from '@/lib/utils'
import api from '@/lib/api'

interface Installment {
  id: number; numero: number; valor: number; dataVencimento: string
  status: string; totalPago: number
}
interface Loan {
  id: number; valor: number; taxaJuros: number; modoTaxa: string
  numeroParcelas: number; dataInicio: string; status: string; observacoes: string
  client: { id: number; nome: string; cpf: string }
  installments: Installment[]
}

export default function EmprestimoDetalhePage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [payInstallmentId, setPayInstallmentId] = useState<number | null>(null)
  const [valorPago, setValorPago] = useState('')
  const [metodo, setMetodo] = useState('dinheiro')

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

  function handlePay(installmentId: number, valor: number) {
    setPayInstallmentId(installmentId)
    setValorPago(String(valor))
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

  if (isLoading) return <div className="space-y-4 max-w-4xl"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>
  if (isError || !loan) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Empréstimo não encontrado.</p>
      <Link href="/emprestimos"><Button variant="outline" className="mt-4">Voltar</Button></Link>
    </div>
  )

  const st = STATUS_LOAN[loan.status] ?? { label: loan.status, variant: 'outline' as const }
  const totalParcelas = loan.installments.reduce((s, i) => s + Number(i.valor), 0)
  const totalPago = loan.installments.reduce((s, i) => s + Number(i.totalPago), 0)
  const pendente = totalParcelas - totalPago

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
          {loan.status === 'ativo' && (
            <>
              <Link href={`/renegociacoes/nova?loanId=${loan.id}`}>
                <Button size="sm" variant="outline" className="gap-1"><RefreshCcw className="size-3.5" />Renegociar</Button>
              </Link>
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => { if (confirm('Cancelar empréstimo?')) cancelMut.mutate() }} disabled={cancelMut.isPending}>
                <XCircle className="size-3.5" />Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Valor Emprestado', value: formatCurrency(loan.valor), color: 'text-foreground' },
          { label: 'Total a Pagar', value: formatCurrency(totalParcelas), color: 'text-foreground' },
          { label: 'Total Pago', value: formatCurrency(totalPago), color: 'text-green-600' },
          { label: 'Pendente', value: formatCurrency(pendente), color: pendente > 0 ? 'text-red-600' : 'text-green-600' },
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
        <CardHeader>
          <CardTitle className="text-base">Informações do Contrato</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground">Taxa de Juros</p><p className="font-medium">{loan.taxaJuros}% {loan.modoTaxa === 'mensal' ? 'a.m.' : 'a.a.'}</p></div>
          <div><p className="text-muted-foreground">Parcelas</p><p className="font-medium">{loan.numeroParcelas}x de {formatCurrency(totalParcelas / loan.numeroParcelas)}</p></div>
          <div><p className="text-muted-foreground">Data de Início</p><p className="font-medium">{formatDate(loan.dataInicio)}</p></div>
          <div><p className="text-muted-foreground">Status</p><Badge variant={st.variant}>{st.label}</Badge></div>
          {loan.observacoes && <div className="col-span-full"><p className="text-muted-foreground">Observações</p><p className="font-medium">{loan.observacoes}</p></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Parcelas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Valor</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Pago</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loan.installments.map((inst) => {
                const ist = STATUS_INSTALLMENT[inst.status] ?? { label: inst.status, variant: 'outline' as const }
                const saldo = Number(inst.valor) - Number(inst.totalPago)
                return (
                  <tr key={inst.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground">{inst.numero}</td>
                    <td className="px-4 py-2">{formatDate(inst.dataVencimento)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(inst.valor)}</td>
                    <td className="px-4 py-2 text-right text-green-600 hidden md:table-cell">{formatCurrency(inst.totalPago)}</td>
                    <td className="px-4 py-2 text-center"><Badge variant={ist.variant}>{ist.label}</Badge></td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {(inst.status === 'pendente' || inst.status === 'atrasado') && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handlePay(inst.id, saldo)}>
                              <DollarSign className="size-3" />Pagar
                            </Button>
                            <Link href={`/pix?parcelaId=${inst.id}`}>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                <QrCode className="size-3" />PIX
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {payInstallmentId && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
          <CardHeader><CardTitle className="text-base text-green-700 dark:text-green-400">Registrar Pagamento — Parcela #{loan.installments.find(i => i.id === payInstallmentId)?.numero}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Valor Pago (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
