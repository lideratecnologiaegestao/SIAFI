'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Loader2, ShieldCheck, ShieldAlert, Bell, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { portalApi } from '@/lib/portal/portal-api'
import { formatCPF, formatPhone } from '@/lib/utils'

const senhaSchema = z.object({
  atual: z.string().min(1, 'Informe a senha atual'),
  nova: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Precisa de maiúscula')
    .regex(/[0-9]/, 'Precisa de número')
    .regex(/[^A-Za-z0-9]/, 'Precisa de caractere especial'),
  confirmar: z.string(),
}).refine(d => d.nova === d.confirmar, { message: 'Senhas não coincidem', path: ['confirmar'] })

type SenhaForm = z.infer<typeof senhaSchema>

export default function PerfilPage() {
  const qc = useQueryClient()
  const [senhaOk, setSenhaOk] = useState(false)
  const [senhaErro, setSenhaErro] = useState<string | null>(null)
  const [showAtual, setShowAtual] = useState(false)
  const [showNova, setShowNova] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'perfil'],
    queryFn: portalApi.getPerfil,
  })

  const notifMutation = useMutation({
    mutationFn: (body: { notificacoesEmail?: boolean; notificacoesWhatsapp?: boolean }) =>
      portalApi.updateNotificacoes(body),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['portal', 'perfil'] })
      const prev = qc.getQueryData(['portal', 'perfil'])
      qc.setQueryData(['portal', 'perfil'], (old: any) => old ? { ...old, ...vars } : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['portal', 'perfil'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['portal', 'perfil'] }),
  })

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SenhaForm>({
    resolver: zodResolver(senhaSchema) as any,
  })

  async function onTrocarSenha(formData: SenhaForm) {
    setSenhaErro(null)
    setSenhaOk(false)
    try {
      const supabase = getSupabaseBrowserClient()
      if (!data?.email) throw new Error('Email não encontrado.')
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: formData.atual,
      })
      if (signInErr) throw new Error('Senha atual incorreta.')
      const { error: updateErr } = await supabase.auth.updateUser({ password: formData.nova })
      if (updateErr) throw new Error(updateErr.message)
      reset()
      setSenhaOk(true)
    } catch (e: any) {
      setSenhaErro(e?.message ?? 'Erro ao trocar senha.')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!data) return null

  const mfaRestantes = Math.max(0, 5 - data.mfaLoginCount)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal">
          <button className="text-muted-foreground hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <h1 className="text-xl font-bold">Meu Perfil</h1>
      </div>

      {/* Dados pessoais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="font-medium">{data.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CPF</p>
              <p className="font-medium">{data.cpf ? formatCPF(data.cpf) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="font-medium truncate">{data.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="font-medium">{data.whatsapp ? formatPhone(data.whatsapp) : '—'}</p>
            </div>
          </div>
          {data.cidade && (
            <div>
              <p className="text-xs text-muted-foreground">Localidade</p>
              <p className="font-medium">{[data.cidade, data.estado].filter(Boolean).join(' - ')}</p>
            </div>
          )}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Para alterar seus dados, entre em contato pelo suporte.{' '}
            <Link href="/portal/suporte/novo" className="underline font-medium">Abrir chamado</Link>
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {data.mfaEnabled
              ? <ShieldCheck className="size-4 text-green-600" />
              : <ShieldAlert className="size-4 text-amber-600" />}
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MFA status */}
          <div className="text-sm space-y-2">
            <p className="font-medium">Autenticação de dois fatores (Google Authenticator)</p>
            {data.mfaEnabled ? (
              <div className="flex items-center gap-2 text-green-700 text-xs">
                <ShieldCheck className="size-3.5" />Ativo e configurado
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-700">
                  Não configurado. Você tem {mfaRestantes} acesso(s) antes de se tornar obrigatório.
                </p>
                <Link href="/portal/mfa-setup">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <ShieldCheck className="size-3.5" />
                    Configurar Google Authenticator
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="font-medium text-sm mb-3 flex items-center gap-1.5">
              <KeyRound className="size-4" />Alterar senha
            </p>
            <form onSubmit={handleSubmit(onTrocarSenha)} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Senha atual</Label>
                <div className="relative">
                  <Input
                    type={showAtual ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pr-10 h-8 text-sm"
                    autoComplete="current-password"
                    {...register('atual')}
                  />
                  <button type="button" onClick={() => setShowAtual(v => !v)} tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showAtual ? 'Ocultar' : 'Mostrar'}>
                    {showAtual ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {errors.atual && <p className="text-xs text-destructive">{errors.atual.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showNova ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    className="pr-10 h-8 text-sm"
                    autoComplete="new-password"
                    {...register('nova')}
                  />
                  <button type="button" onClick={() => setShowNova(v => !v)} tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showNova ? 'Ocultar' : 'Mostrar'}>
                    {showNova ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {errors.nova && <p className="text-xs text-destructive">{errors.nova.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirmar nova senha</Label>
                <Input type="password" placeholder="Repita a senha" className="h-8 text-sm" autoComplete="new-password" {...register('confirmar')} />
                {errors.confirmar && <p className="text-xs text-destructive">{errors.confirmar.message}</p>}
              </div>
              {senhaErro && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-xs text-destructive">{senhaErro}</p>
                </div>
              )}
              {senhaOk && <p className="text-xs text-green-700 font-medium">Senha alterada com sucesso!</p>}
              <Button type="submit" size="sm" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="size-3.5 animate-spin mr-2" />}
                Salvar nova senha
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4" />Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">WhatsApp</p>
              <p className="text-xs text-muted-foreground">Lembretes e confirmações</p>
            </div>
            <button
              role="switch"
              aria-checked={data.notificacoesWhatsapp}
              aria-label="Notificações por WhatsApp"
              onClick={() => notifMutation.mutate({ notificacoesWhatsapp: !data.notificacoesWhatsapp })}
              className={`relative w-10 h-6 rounded-full transition-colors ${data.notificacoesWhatsapp ? 'bg-blue-600' : 'bg-muted'}`}
              disabled={notifMutation.isPending}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${data.notificacoesWhatsapp ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">E-mail</p>
              <p className="text-xs text-muted-foreground">Confirmações de pagamento</p>
            </div>
            <button
              role="switch"
              aria-checked={data.notificacoesEmail}
              aria-label="Notificações por e-mail"
              onClick={() => notifMutation.mutate({ notificacoesEmail: !data.notificacoesEmail })}
              className={`relative w-10 h-6 rounded-full transition-colors ${data.notificacoesEmail ? 'bg-blue-600' : 'bg-muted'}`}
              disabled={notifMutation.isPending}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${data.notificacoesEmail ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
