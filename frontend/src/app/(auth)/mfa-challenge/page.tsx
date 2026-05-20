'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth.context'
import { mfaChallengeAndVerify, mfaListFactors, type MfaFactor } from '@/lib/supabase/mfa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function MfaChallengePage() {
  const { completeMfa } = useAuth()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [factor, setFactor] = useState<MfaFactor | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mfaListFactors()
      .then((factors) => {
        const verified = factors.find((f) => f.status === 'verified' && f.factor_type === 'totp')
        if (!verified) {
          // No verified factor — send to setup
          router.replace('/mfa-setup')
          return
        }
        setFactor(verified)
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      })
      .catch(() => {
        setError('Erro ao carregar autenticação. Faça login novamente.')
        setLoading(false)
      })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!factor || code.length !== 6) return
    setError(null)
    setSubmitting(true)
    try {
      const { access_token } = await mfaChallengeAndVerify(factor.id, code)
      await completeMfa(access_token)
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err?.message ?? 'Código inválido. Tente novamente.')
      setCode('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="pb-4 text-center">
        <div className="flex justify-center mb-3">
          <div className="size-12 rounded-full bg-blue-100 flex items-center justify-center">
            <ShieldCheck className="size-6 text-blue-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Verificação em duas etapas</CardTitle>
        <p className="text-sm text-muted-foreground">
          Insira o código de 6 dígitos do seu aplicativo autenticador.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="totp-code">Código de verificação</Label>
            <Input
              id="totp-code"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest font-mono h-14"
              autoComplete="one-time-code"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10"
            disabled={submitting || code.length !== 6}
          >
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            {submitting ? 'Verificando...' : 'Verificar'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Abra o Google Authenticator ou outro app TOTP para ver o código.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
