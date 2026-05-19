'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Calculator } from 'lucide-react'
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { formatCurrency, METODO_PAGAMENTO } from '@/lib/utils'
import api from '@/lib/api'

const schema = z.object({
  clientId: z.coerce.number().min(1, 'Selecione um cliente'),
  valor: z.coerce.number().min(1, 'Valor deve ser maior que zero'),
  valorInvestido: z.coerce.number().optional(),
  valorParcela: z.coerce.number().min(0.01, 'Valor da parcela deve ser maior que zero'),
  numeroParcelas: z.coerce.number().min(1).max(360),
  metodoPagamento: z.string().min(1),
  dataInicio: z.string().min(1, 'Data de início obrigatória'),
  observacoes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function NovoEmprestimoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const preClienteId = searchParams.get('clienteId')

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get<any>('/clients', { params: { limit: 200 } }).then((r) => r.data.data ?? r.data),
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      metodoPagamento: 'dinheiro',
      numeroParcelas: 12,
      dataInicio: new Date().toISOString().split('T')[0],
      clientId: preClienteId ? Number(preClienteId) : 0,
    },
  })

  useEffect(() => { if (preClienteId) setValue('clientId', Number(preClienteId)) }, [preClienteId, setValue])

  const valor = watch('valor')
  const valorParcela = watch('valorParcela')
  const numeroParcelas = watch('numeroParcelas')

  const totalAPagar = (valorParcela || 0) * (numeroParcelas || 0)
  const totalJuros = totalAPagar - (valor || 0)

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/loans', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      router.push(`/emprestimos/${res.data.id}`)
    },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/emprestimos"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button></Link>
        <div><h1 className="text-2xl font-bold tracking-tight">Novo Empréstimo</h1><p className="text-muted-foreground text-sm">Cadastrar contrato de empréstimo</p></div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {mutation.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao criar empréstimo. Verifique os dados.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Empréstimo</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Cliente *</Label>
              <Select {...register('clientId', { valueAsNumber: true })}>
                <option value="">Selecione o cliente...</option>
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome} — CPF: {c.cpf}</option>
                ))}
              </Select>
              {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Valor do Empréstimo (R$) *</Label>
              <Input type="number" step="0.01" min="0" {...register('valor')} placeholder="0,00" />
              {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Valor Investido (R$)</Label>
              <Input type="number" step="0.01" min="0" {...register('valorInvestido')} placeholder="0,00" />
            </div>

            <div className="space-y-1.5">
              <Label>Número de Parcelas *</Label>
              <Input type="number" min="1" max="360" {...register('numeroParcelas')} />
              {errors.numeroParcelas && <p className="text-xs text-destructive">{errors.numeroParcelas.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Valor da Parcela (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" {...register('valorParcela')} placeholder="0,00" />
              {errors.valorParcela && <p className="text-xs text-destructive">{errors.valorParcela.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Forma de Pagamento *</Label>
              <Select {...register('metodoPagamento')}>
                {Object.entries(METODO_PAGAMENTO).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Data de Início *</Label>
              <Input type="date" {...register('dataInicio')} />
              {errors.dataInicio && <p className="text-xs text-destructive">{errors.dataInicio.message}</p>}
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea {...register('observacoes')} placeholder="Informações adicionais..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {valor > 0 && valorParcela > 0 && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Calculator className="size-4" />Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Capital</p>
                <p className="font-bold text-lg">{formatCurrency(valor || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parcelas</p>
                <p className="font-bold text-lg">{numeroParcelas}x de {formatCurrency(valorParcela || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total a Pagar</p>
                <p className="font-bold text-lg text-blue-700 dark:text-blue-400">{formatCurrency(totalAPagar)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Acréscimo</p>
                <p className={`font-bold text-lg ${totalJuros >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(totalJuros))}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/emprestimos"><Button variant="outline" type="button">Cancelar</Button></Link>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="size-4" />{mutation.isPending ? 'Criando...' : 'Criar Empréstimo'}
          </Button>
        </div>
      </form>
    </div>
  )
}
