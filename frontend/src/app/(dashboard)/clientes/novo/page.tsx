'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'

const schema = z.object({
  nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  cpf: z.string().min(11, 'CPF inválido').max(14),
  rg: z.string().optional(),
  dataNascimento: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().optional(),
  observacoes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function NovoClientePage() {
  const router = useRouter()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/clients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      router.push('/clientes')
    },
  })

  function onSubmit(data: FormData) {
    mutation.mutate(data)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/clientes">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Cliente</h1>
          <p className="text-muted-foreground text-sm mt-1">Preencha os dados do cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {mutation.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao cadastrar cliente. Verifique os dados e tente novamente.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" {...register('nome')} placeholder="Nome do cliente" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF *</Label>
              <Input id="cpf" {...register('cpf')} placeholder="000.000.000-00" />
              {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg">RG</Label>
              <Input id="rg" {...register('rg')} placeholder="00.000.000-0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input id="dataNascimento" type="date" {...register('dataNascimento')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register('email')} placeholder="email@exemplo.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input id="whatsapp" {...register('whatsapp')} placeholder="(00) 00000-0000" />
              {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...register('telefone')} placeholder="(00) 0000-0000" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" {...register('endereco')} placeholder="Rua, número, complemento" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" {...register('bairro')} placeholder="Bairro" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" {...register('cep')} placeholder="00000-000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...register('cidade')} placeholder="Cidade" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estado">UF</Label>
              <Select id="estado" {...register('estado')}>
                <option value="">Selecione...</option>
                {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
          <CardContent>
            <Textarea {...register('observacoes')} placeholder="Informações adicionais sobre o cliente..." rows={4} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/clientes"><Button variant="outline" type="button">Cancelar</Button></Link>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="size-4" />
            {mutation.isPending ? 'Salvando...' : 'Salvar Cliente'}
          </Button>
        </div>
      </form>
    </div>
  )
}
