'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate, METODO_PAGAMENTO } from '@/lib/utils'
import api from '@/lib/api'

const schema = z.object({
  installmentId: z.coerce.number().min(1, 'Selecione uma parcela'),
  valorPago: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  dataPagamento: z.string().min(1, 'Data obrigatória'),
  metodoPagamento: z.string().min(1, 'Método obrigatório'),
  observacao: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Installment {
  id: number; numero: number; valor: number; totalPago: number; status: string
  loan: { id: number; valor: number; client: { nome: string } }
}

export default function NovoPagamentoPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const preParcelaId = searchParams.get('parcelaId')

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get<any>('/clients', { params: { limit: 200 } }).then((r) => r.data.data ?? r.data),
  })

  const [clienteId, setClienteId] = useState('')
  const [loanId, setLoanId] = useState('')

  const { data: loans } = useQuery({
    queryKey: ['loans-by-client', clienteId],
    queryFn: () => api.get<any>('/loans', { params: { clientId: clienteId, status: 'ativo', limit: 50 } }).then((r) => r.data.data ?? r.data),
    enabled: !!clienteId,
  })

  const { data: installments } = useQuery({
    queryKey: ['installments-by-loan', loanId],
    queryFn: () => api.get<Installment>(`/loans/${loanId}`).then((r) => (r.data as any).installments?.filter((i: any) => i.status !== 'pago' && i.status !== 'cancelado') ?? []),
    enabled: !!loanId,
  })

  const { data: preInstallment } = useQuery({
    queryKey: ['installment', preParcelaId],
    queryFn: () => api.get<Installment>(`/installments/${preParcelaId}`).then((r) => r.data),
    enabled: !!preParcelaId,
  })

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      dataPagamento: new Date().toISOString().split('T')[0],
      metodoPagamento: 'dinheiro',
    },
  })

  const installmentId = watch('installmentId')
  const selectedInst = (installments as any[])?.find((i: any) => i.id === Number(installmentId)) ?? preInstallment

  useEffect(() => {
    if (preParcelaId) setValue('installmentId', Number(preParcelaId))
    if (preInstallment) setValue('valorPago', Number(preInstallment.valor) - Number(preInstallment.totalPago))
  }, [preParcelaId, preInstallment, setValue])

  useEffect(() => {
    if (selectedInst && !preParcelaId) {
      setValue('valorPago', Number(selectedInst.valor) - Number(selectedInst.totalPago))
    }
  }, [installmentId, selectedInst, setValue, preParcelaId])

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/payments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['installments'] })
      router.push('/pagamentos')
    },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/pagamentos"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button></Link>
        <div><h1 className="text-2xl font-bold tracking-tight">Registrar Pagamento</h1><p className="text-muted-foreground text-sm">Registrar recebimento de parcela</p></div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {mutation.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao registrar pagamento.
          </div>
        )}

        {!preParcelaId && (
          <Card>
            <CardHeader><CardTitle className="text-base">Localizar Parcela</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLoanId('') }}>
                  <option value="">Selecione o cliente...</option>
                  {(clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </div>
              {clienteId && (
                <div className="space-y-1.5">
                  <Label>Empréstimo</Label>
                  <Select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
                    <option value="">Selecione o empréstimo...</option>
                    {((loans ?? []) as any[]).map((l: any) => (
                      <option key={l.id} value={l.id}>#{l.id} — {formatCurrency(l.valor)} — {l.numeroParcelas}x</option>
                    ))}
                  </Select>
                </div>
              )}
              {loanId && (
                <div className="space-y-1.5">
                  <Label>Parcela *</Label>
                  <Select {...register('installmentId', { valueAsNumber: true })}>
                    <option value="">Selecione a parcela...</option>
                    {((installments ?? []) as any[]).map((i: any) => (
                      <option key={i.id} value={i.id}>
                        P{i.numero} — Venc. {formatDate(i.dataVencimento)} — Saldo: {formatCurrency(Number(i.valor) - Number(i.totalPago))}
                      </option>
                    ))}
                  </Select>
                  {errors.installmentId && <p className="text-xs text-destructive">{errors.installmentId.message}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(preInstallment || selectedInst) && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-4 text-sm space-y-1">
              <p className="font-medium text-blue-700 dark:text-blue-400">Parcela #{selectedInst?.numero ?? preInstallment?.numero}</p>
              <p className="text-muted-foreground">Cliente: {(selectedInst ?? preInstallment)?.loan?.client?.nome}</p>
              <p className="text-muted-foreground">Valor: {formatCurrency((selectedInst ?? preInstallment)?.valor ?? 0)} · Pago: {formatCurrency((selectedInst ?? preInstallment)?.totalPago ?? 0)}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Pagamento</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Valor Pago (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" {...register('valorPago')} />
              {errors.valorPago && <p className="text-xs text-destructive">{errors.valorPago.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Data do Pagamento *</Label>
              <Input type="date" {...register('dataPagamento')} />
              {errors.dataPagamento && <p className="text-xs text-destructive">{errors.dataPagamento.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Método de Pagamento *</Label>
              <Select {...register('metodoPagamento')}>
                {Object.entries(METODO_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              {errors.metodoPagamento && <p className="text-xs text-destructive">{errors.metodoPagamento.message}</p>}
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Observação</Label>
              <Textarea {...register('observacao')} placeholder="Observações sobre o pagamento..." rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/pagamentos"><Button variant="outline" type="button">Cancelar</Button></Link>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="size-4" />{mutation.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </form>
    </div>
  )
}
