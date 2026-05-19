'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'

const schema = z.object({
  nome: z.string().min(3), cpf: z.string().min(11).max(14), rg: z.string().optional(),
  dataNascimento: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().min(10), telefone: z.string().optional(),
  endereco: z.string().optional(), bairro: z.string().optional(),
  cidade: z.string().optional(), estado: z.string().max(2).optional(),
  cep: z.string().optional(), observacoes: z.string().optional(),
  active: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>
const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function EditarClientePage() {
  const { id } = useParams()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<any>(`/clients/${id}`).then((r) => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  useEffect(() => {
    if (client) {
      reset({
        ...client,
        dataNascimento: client.dataNascimento ? client.dataNascimento.split('T')[0] : '',
        email: client.email ?? '',
      })
    }
  }, [client, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.patch(`/clients/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      router.push(`/clientes/${id}`)
    },
  })

  if (isLoading) return <div className="space-y-4 max-w-4xl"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href={`/clientes/${id}`}><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button></Link>
        <div><h1 className="text-2xl font-bold tracking-tight">Editar Cliente</h1><p className="text-muted-foreground text-sm">{client?.nome}</p></div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {mutation.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao salvar alterações.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Nome completo *</Label>
              <Input {...register('nome')} />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1.5"><Label>CPF *</Label><Input {...register('cpf')} />{errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}</div>
            <div className="space-y-1.5"><Label>RG</Label><Input {...register('rg')} /></div>
            <div className="space-y-1.5"><Label>Data de Nascimento</Label><Input type="date" {...register('dataNascimento')} /></div>
            <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" {...register('email')} />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
            <div className="space-y-1.5"><Label>WhatsApp *</Label><Input {...register('whatsapp')} />{errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp.message}</p>}</div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input {...register('telefone')} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select {...register('active', { setValueAs: (v) => v === 'true' })}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5"><Label>Endereço</Label><Input {...register('endereco')} /></div>
            <div className="space-y-1.5"><Label>Bairro</Label><Input {...register('bairro')} /></div>
            <div className="space-y-1.5"><Label>CEP</Label><Input {...register('cep')} /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input {...register('cidade')} /></div>
            <div className="space-y-1.5"><Label>UF</Label>
              <Select {...register('estado')}>
                <option value="">Selecione...</option>
                {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
          <CardContent><Textarea {...register('observacoes')} rows={4} /></CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/clientes/${id}`}><Button variant="outline" type="button">Cancelar</Button></Link>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="size-4" />{mutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </div>
  )
}
