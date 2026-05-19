'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { QrCode, RefreshCw, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import api from '@/lib/api'

const schema = z.object({ installmentId: z.coerce.number().min(1) })
type FormData = z.infer<typeof schema>

interface PixPayment {
  id: number; qrCode: string; qrImage: string; amount: number; status: string
  sentAt: string; createdAt: string
  installment: { id: number; numero: number; loan: { id: number; client: { nome: string } } }
}

export default function PixPage() {
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const preParcelaId = searchParams.get('parcelaId')
  const [copied, setCopied] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [loanId, setLoanId] = useState('')

  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: () => api.get<any>('/clients', { params: { limit: 200 } }).then(r => r.data.data ?? r.data) })
  const { data: loans } = useQuery({ queryKey: ['loans-by-client-pix', clienteId], queryFn: () => api.get<any>('/loans', { params: { clientId: clienteId, status: 'ativo', limit: 50 } }).then(r => r.data.data ?? r.data), enabled: !!clienteId })
  const { data: installments } = useQuery({ queryKey: ['installments-by-loan-pix', loanId], queryFn: () => api.get<any>(`/loans/${loanId}`).then(r => r.data.installments?.filter((i: any) => i.status !== 'pago' && i.status !== 'cancelado') ?? []), enabled: !!loanId })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { installmentId: preParcelaId ? Number(preParcelaId) : 0 },
  })

  const installmentId = watch('installmentId')
  const { data: pixData, isLoading: loadingPix } = useQuery({
    queryKey: ['pix', installmentId],
    queryFn: () => api.get<PixPayment[]>(`/pix/${installmentId}`).then(r => r.data),
    enabled: !!installmentId && installmentId > 0,
  })

  const generateMut = useMutation({
    mutationFn: (data: FormData) => api.post('/pix/generate', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pix', installmentId] }),
  })

  function copyQR(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const latestPix = pixData?.[0]
  const selectedInst = (installments as any[])?.find((i: any) => i.id === Number(installmentId))

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><QrCode className="size-6" />PIX</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerar QR Code PIX para pagamento de parcela</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Selecionar Parcela</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!preParcelaId && (
            <>
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLoanId('') }}>
                  <option value="">Selecione...</option>
                  {(clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </div>
              {clienteId && (
                <div className="space-y-1.5">
                  <Label>Empréstimo</Label>
                  <Select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {((loans ?? []) as any[]).map((l: any) => <option key={l.id} value={l.id}>#{l.id} — {formatCurrency(l.valor)}</option>)}
                  </Select>
                </div>
              )}
              {loanId && (
                <div className="space-y-1.5">
                  <Label>Parcela</Label>
                  <Select {...register('installmentId', { valueAsNumber: true })}>
                    <option value="">Selecione...</option>
                    {((installments ?? []) as any[]).map((i: any) => (
                      <option key={i.id} value={i.id}>P{i.numero} — Venc. {formatDate(i.dataVencimento)} — {formatCurrency(Number(i.valor) - Number(i.totalPago))}</option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}

          {installmentId > 0 && selectedInst && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
              <p className="font-medium">Parcela #{selectedInst.numero}</p>
              <p className="text-muted-foreground">Saldo: {formatCurrency(Number(selectedInst.valor) - Number(selectedInst.totalPago))}</p>
            </div>
          )}

          {installmentId > 0 && (
            <Button onClick={handleSubmit((d) => generateMut.mutate(d))} disabled={generateMut.isPending} className="gap-2 w-full">
              <QrCode className="size-4" />{generateMut.isPending ? 'Gerando QR Code...' : 'Gerar QR Code PIX'}
            </Button>
          )}
        </CardContent>
      </Card>

      {loadingPix ? (
        <Skeleton className="h-64 w-full" />
      ) : latestPix ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">QR Code PIX</CardTitle>
            <Badge variant={latestPix.status === 'pago' ? 'success' : 'warning'}>
              {latestPix.status === 'pago' ? 'Pago' : 'Aguardando'}
            </Badge>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {latestPix.qrImage && (
              <img src={`data:image/png;base64,${latestPix.qrImage}`} alt="QR Code PIX" className="mx-auto max-w-[200px] rounded-lg" />
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Copia e Cola</p>
              <div className="flex gap-2">
                <Input readOnly value={latestPix.qrCode} className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={() => copyQR(latestPix.qrCode)} className="shrink-0">
                  {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Valor: <span className="font-bold text-foreground">{formatCurrency(latestPix.amount)}</span></p>
            <p className="text-xs text-muted-foreground">Gerado em {formatDateTime(latestPix.createdAt)}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
