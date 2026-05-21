'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { portalApi } from '@/lib/portal/portal-api'

const ASSUNTOS = [
  'Dúvida sobre parcela',
  'Problema com pagamento PIX',
  'Solicitação de renegociação',
  'Atualização de dados cadastrais',
  'Outro',
]

const schema = z.object({
  assunto: z.string().min(1, 'Selecione ou informe um assunto'),
  mensagem: z.string().min(10, 'Mensagem muito curta').max(500, 'Máximo 500 caracteres'),
})

type FormData = z.infer<typeof schema>

export default function NovoTicketPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: contratos } = useQuery({
    queryKey: ['portal', 'contratos'],
    queryFn: portalApi.getContratos,
  })

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  const mensagemLen = (watch('mensagem') || '').length

  const mutation = useMutation({
    mutationFn: (data: FormData) => portalApi.createTicket(data.assunto, data.mensagem),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'suporte'] })
      router.push('/portal/suporte')
    },
  })

  async function onSubmit(data: FormData) {
    await mutation.mutateAsync(data)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal/suporte">
          <button className="text-muted-foreground hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <h1 className="text-xl font-bold">Novo Chamado</h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Descreva sua dúvida ou problema</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="assunto">Assunto *</Label>
              <select
                id="assunto"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('assunto')}
              >
                <option value="">Selecione o assunto</option>
                {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {errors.assunto && <p className="text-xs text-destructive">{errors.assunto.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="mensagem">Mensagem *</Label>
                <span className={`text-xs ${mensagemLen > 480 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {mensagemLen} / 500
                </span>
              </div>
              <Textarea
                id="mensagem"
                rows={5}
                placeholder="Descreva detalhadamente sua dúvida ou problema..."
                {...register('mensagem')}
              />
              {errors.mensagem && <p className="text-xs text-destructive">{errors.mensagem.message}</p>}
            </div>

            {mutation.isError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">Erro ao enviar chamado. Tente novamente.</p>
              </div>
            )}

            <div className="flex gap-2">
              <Link href="/portal/suporte" className="flex-1">
                <Button type="button" variant="outline" className="w-full">Cancelar</Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={isSubmitting || mutation.isPending}>
                {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                Enviar chamado
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
