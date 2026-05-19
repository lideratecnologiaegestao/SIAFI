'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, RefreshCcw } from 'lucide-react'
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import api from '@/lib/api'

const schema = z.object({
  loanId: z.coerce.number().min(1, 'Selecione um empréstimo'),
  numeroParcelas: z.coerce.number().min(1).max(360),
  taxaJuros: z.coerce.number().min(0).max(100),
  dataInicio: z.string().min(1),
  observacoes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function NovaRenegociacaoPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const preLoanId = searchParams.get('loanId')

  const { data: loans } = useQuery({
    queryKey: ['loans-ativos'],
    queryFn: () => api.get<any>('/loans', { params: { status: 'ativo', limit: 200 } }).then((r) => r.data.data ?? r.data),
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      taxaJuros: 5,
      numeroParcelas: 12,
      dataInicio: new Date().toISOString().split('T')[0],
      loanId: preLoanId ? Number(preLoanId) : 0,
    },
  })

  const loanId = watch('loanId')
  const selectedLoan = (loans ?? []).find((l: any) => l.id === Number(loanId))

  useEffect(() => { if (preLoanId) setValue('loanId', Number(preLoanId)) }, [preLoanId, setValue])

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/renegociacoes', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['renegociacoes'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      router.push('/renegociacoes')
    },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/renegociacoes"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><RefreshCcw className="size-5" />Nova Renegociação</h1>
          <p className="text-muted-foreground text-sm">Renegociar parcelas em atraso</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {mutation.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao criar renegociação. Verifique se o empréstimo tem parcelas pendentes/atrasadas.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Selecionar Empréstimo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Empréstimo *</Label>
              <Select {...register('loanId', { valueAsNumber: true })}>
                <option value="">Selecione o empréstimo...</option>
                {((loans ?? []) as any[]).map((l: any) => (
                  <option key={l.id} value={l.id}>#{l.id} — {l.client?.nome} — {formatCurrency(l.valor)}</option>
                ))}
              </Select>
              {errors.loanId && <p className="text-xs text-destructive">{errors.loanId.message}</p>}
            </div>

            {selectedLoan && (
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                <p className="font-medium">{selectedLoan.client?.nome}</p>
                <p className="text-muted-foreground">Valor: {formatCurrency(selectedLoan.valor)} · {selectedLoan.numeroParcelas}x · Início: {formatDate(selectedLoan.dataInicio)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Condições da Renegociação</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Novas Parcelas *</Label>
              <Input type="number" min="1" max="360" {...register('numeroParcelas')} />
              {errors.numeroParcelas && <p className="text-xs text-destructive">{errors.numeroParcelas.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Nova Taxa de Juros (% a.m.) *</Label>
              <Input type="number" step="0.01" min="0" max="100" {...register('taxaJuros')} />
              {errors.taxaJuros && <p className="text-xs text-destructive">{errors.taxaJuros.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Data de Início *</Label>
              <Input type="date" {...register('dataInicio')} />
              {errors.dataInicio && <p className="text-xs text-destructive">{errors.dataInicio.message}</p>}
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea {...register('observacoes')} placeholder="Motivo e condições da renegociação..." rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          Atenção: As parcelas pendentes e em atraso serão canceladas e substituídas pelas novas condições negociadas.
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/renegociacoes"><Button variant="outline" type="button">Cancelar</Button></Link>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="size-4" />{mutation.isPending ? 'Processando...' : 'Confirmar Renegociação'}
          </Button>
        </div>
      </form>
    </div>
  )
}
