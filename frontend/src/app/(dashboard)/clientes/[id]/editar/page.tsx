'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'

function formatCpfCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

const schema = z.object({
  nome: z.string().min(3),
  cpf: z.string()
    .optional()
    .refine((v) => {
      if (!v) return true
      const d = v.replace(/\D/g, '')
      return d.length === 11 || d.length === 14
    }, 'CPF (11 dígitos) ou CNPJ (14 dígitos)'),
  rg: z.string().optional(),
  dataNascimento: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().min(10), telefone: z.string().optional(),
  endereco: z.string().optional(), bairro: z.string().optional(),
  cidade: z.string().optional(), estado: z.string().max(2).optional(),
  cep: z.string().optional(), observacoes: z.string().optional(),
  active: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>
const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function FileInput({
  label,
  name,
  accept,
  file,
  existing,
  onChange,
}: {
  label: string
  name: string
  accept: string
  file: File | null
  existing?: boolean
  onChange: (f: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => ref.current?.click()}
        >
          <Upload className="size-3.5" />
          {file ? 'Trocar' : existing ? 'Substituir' : 'Selecionar'}
        </Button>
        {file ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <span className="truncate">{file.name}</span>
            <button type="button" onClick={() => { onChange(null); if (ref.current) ref.current.value = '' }}>
              <X className="size-3.5 shrink-0 hover:text-destructive" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {existing ? 'Arquivo existente (clique para substituir)' : 'Nenhum arquivo'}
          </span>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

export default function EditarClientePage() {
  const { id } = useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const [foto, setFoto] = useState<File | null>(null)
  const [rgFile, setRgFile] = useState<File | null>(null)
  const [comprovante, setComprovante] = useState<File | null>(null)

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<any>(`/clients/${id}`).then((r) => r.data),
  })

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
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
    mutationFn: (data: FormData) => {
      const fd = new window.FormData()
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== '') fd.append(k, String(v)) })
      if (foto) fd.append('foto', foto)
      if (rgFile) fd.append('rg', rgFile)
      if (comprovante) fd.append('comprovante', comprovante)
      return api.patch(`/clients/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
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
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-1">
            <p className="font-medium">Erro ao salvar alterações.</p>
            {(() => {
              const err = mutation.error as any
              const msg = err?.response?.data?.message
              if (!msg) return null
              const msgs = Array.isArray(msg) ? msg : [msg]
              return msgs.map((m: string, i: number) => <p key={i} className="text-xs opacity-80">{m}</p>)
            })()}
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
            <div className="space-y-1.5">
              <Label>CPF / CNPJ</Label>
              <Controller
                name="cpf"
                control={control}
                render={({ field }) => (
                  <Input
                    value={formatCpfCnpj(field.value ?? '')}
                    onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                    onBlur={field.onBlur}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    maxLength={18}
                  />
                )}
              />
              {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
            </div>
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
          <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FileInput
              label="Foto do Cliente"
              name="foto"
              accept="image/jpeg,image/png,image/webp"
              file={foto}
              existing={!!client?.fotoPath}
              onChange={setFoto}
            />
            <FileInput
              label="RG (frente)"
              name="rg"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              file={rgFile}
              existing={!!client?.rgPath}
              onChange={setRgFile}
            />
            <FileInput
              label="Comprovante de Endereço"
              name="comprovante"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              file={comprovante}
              existing={!!client?.comprovantePath}
              onChange={setComprovante}
            />
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
