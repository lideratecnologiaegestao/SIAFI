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
import { Select } from '@/components/ui/select'
import api from '@/lib/api'

const schema = z.object({
  nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  username: z.string().min(3, 'Username deve ter ao menos 3 caracteres').regex(/^[a-z0-9_.]+$/, 'Use apenas letras minúsculas, números, . e _'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'financeiro', 'caixa', 'usuario', 'cliente']),
})
type FormData = z.infer<typeof schema>

export default function NovoUsuarioPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { role: 'usuario' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      router.push('/usuarios')
    },
  })

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Link href="/usuarios"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="size-4" />Voltar</Button></Link>
        <div><h1 className="text-2xl font-bold tracking-tight">Novo Usuário</h1><p className="text-muted-foreground text-sm">Criar operador do sistema</p></div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        {mutation.isError && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao criar usuário. Username pode já estar em uso.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Usuário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input {...register('nome')} placeholder="Nome do operador" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Username (login) *</Label>
              <Input {...register('username')} placeholder="usuario.nome" />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Senha *</Label>
              <Input type="password" {...register('password')} placeholder="Mínimo 8 caracteres" />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Perfil de Acesso *</Label>
              <Select {...register('role')}>
                <option value="usuario">Usuário (somente visualização)</option>
                <option value="caixa">Caixa (pagamentos e clientes)</option>
                <option value="financeiro">Financeiro (operacional completo)</option>
                <option value="admin">Administrador (acesso total)</option>
                <option value="cliente">Cliente (portal do cliente)</option>
              </Select>
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Link href="/usuarios"><Button variant="outline" type="button">Cancelar</Button></Link>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="size-4" />{mutation.isPending ? 'Criando...' : 'Criar Usuário'}
          </Button>
        </div>
      </form>
    </div>
  )
}
