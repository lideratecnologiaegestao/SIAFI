'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, ShieldCheck } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { portalTokenStore } from '@/lib/portal/portal-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

function getRedirectParam() {
  if (typeof window === 'undefined') return '/portal'
  const r = new URLSearchParams(window.location.search).get('redirect')
  return r?.startsWith('/') ? r : '/portal'
}

export default function PortalMfaChallengePage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.mfa.listFactors()
      .then(({ data, error: listError }: any) => {
        if (listError) throw listError
        const verified = data?.all?.find((f: any) => f.status === 'verified' && f.factor_type === 'totp')
        if (!verified) {
          router.replace('/portal/mfa-setup?redirect=' + encodeURIComponent(getRedirectParam()))
          return
        }
        setFactorId(verified.id)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar. Faça login novamente.')
        setLoading(false)
      })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setError(null)
    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (verifyError) throw verifyError

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        portalTokenStore.set(session.access_token)
      }
      router.replace(getRedirectParam())
    } catch (e: any) {
      setError(e?.message ?? 'Código inválido. Tente novamente.')
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="SIAFI" width={140} height={42} className="h-10 w-auto object-contain" priority />
          </div>
          <div className="flex justify-center mb-2">
            <div className="size-12 rounded-full bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="size-6 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Verificação em dois fatores</h1>
          <p className="text-sm text-muted-foreground">
            Abra o Google Authenticator e digite o código de 6 dígitos.
          </p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest font-mono h-14"
              autoComplete="one-time-code"
              aria-label="Código de verificação de 6 dígitos"
              disabled={submitting}
            />
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
              {submitting ? <><Loader2 className="size-4 animate-spin mr-2" />Verificando...</> : 'Verificar →'}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">O código se renova a cada 30 segundos.</p>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">Não consigo acessar meu autenticador.</p>
          <Link href="/portal/suporte/novo" className="text-xs text-blue-600 hover:underline">
            Abrir chamado de suporte
          </Link>
        </div>
      </div>
    </div>
  )
}
