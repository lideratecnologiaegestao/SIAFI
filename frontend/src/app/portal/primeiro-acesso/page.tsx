'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Image from 'next/image'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth.context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { portalApi } from '@/lib/portal/portal-api'

const schema = z.object({
  nova: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Precisa de uma letra maiúscula')
    .regex(/[0-9]/, 'Precisa de um número')
    .regex(/[^A-Za-z0-9]/, 'Precisa de um caractere especial'),
  confirmar: z.string(),
}).refine(d => d.nova === d.confirmar, { message: 'As senhas não coincidem', path: ['confirmar'] })

type FormData = z.infer<typeof schema>

function calcForca(senha: string): { nivel: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  let pts = 0
  if (senha.length >= 8) pts++
  if (/[A-Z]/.test(senha)) pts++
  if (/[0-9]/.test(senha)) pts++
  if (/[^A-Za-z0-9]/.test(senha)) pts++
  const labels = ['', 'Fraca', 'Média', 'Boa', 'Forte']
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-green-500']
  return { nivel: pts as 0 | 1 | 2 | 3 | 4, label: labels[pts], color: colors[pts] }
}

export default function PrimeiroAcessoPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [showNova, setShowNova] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [novaSenhaValue, setNovaSenhaValue] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  const forca = calcForca(watch('nova') || '')

  const marcarConcluido = useMutation({ mutationFn: portalApi.marcarPrimeiroAcesso })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login')
    if (!isLoading && user && user.role !== 'cliente') router.replace('/dashboard')
  }, [isAuthenticated, isLoading, user, router])

  async function onSubmit(data: FormData) {
    setErro(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password: data.nova })
      if (error) throw new Error(error.message)
      await marcarConcluido.mutateAsync()
      router.replace('/portal')
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao salvar a senha. Tente novamente.')
    }
  }

  const reqItems = [
    { ok: (watch('nova') || '').length >= 8, label: '8+ caracteres' },
    { ok: /[A-Z]/.test(watch('nova') || ''), label: 'Uma maiúscula' },
    { ok: /[0-9]/.test(watch('nova') || ''), label: 'Um número' },
    { ok: /[^A-Za-z0-9]/.test(watch('nova') || ''), label: 'Um especial' },
  ]

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="SIAFI" width={140} height={42} className="h-10 w-auto object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao Portal Lidera!</h1>
          <p className="text-sm text-muted-foreground">
            Por segurança, defina sua senha pessoal antes de continuar.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={showNova ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                  autoComplete="new-password"
                  {...register('nova')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNova(v => !v)}
                  tabIndex={-1}
                  aria-label={showNova ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showNova ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.nova && <p className="text-xs text-destructive">{errors.nova.message}</p>}
            </div>

            {/* Barra de força */}
            {watch('nova') && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${forca.nivel >= n ? forca.color : 'bg-muted'}`}
                    />
                  ))}
                </div>
                {forca.nivel > 0 && (
                  <p className="text-xs text-muted-foreground">Força: {forca.label}</p>
                )}
              </div>
            )}

            {/* Requisitos */}
            <div className="grid grid-cols-2 gap-1">
              {reqItems.map(r => (
                <p key={r.label} className={`text-xs flex items-center gap-1 ${r.ok ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {r.ok ? '✓' : '○'} {r.label}
                </p>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  type={showConfirmar ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  className="pr-10"
                  autoComplete="new-password"
                  {...register('confirmar')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmar(v => !v)}
                  tabIndex={-1}
                  aria-label={showConfirmar ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirmar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.confirmar && <p className="text-xs text-destructive">{errors.confirmar.message}</p>}
            </div>

            {erro && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{erro}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || forca.nivel < 4}>
              {isSubmitting
                ? <><Loader2 className="size-4 animate-spin mr-2" />Salvando...</>
                : 'Salvar senha e continuar →'
              }
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          SIAFI · Lidera &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
