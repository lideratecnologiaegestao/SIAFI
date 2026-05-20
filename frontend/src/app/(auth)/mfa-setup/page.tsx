'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth.context'
import { mfaChallengeAndVerify, mfaEnroll, type EnrollResult } from '@/lib/supabase/mfa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function MfaSetupPage() {
  const { completeMfa } = useAuth()
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<EnrollResult | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mfaEnroll()
      .then((result) => {
        setEnrollment(result)
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      })
      .catch((err) => {
        setError(err?.message ?? 'Erro ao iniciar configuração do MFA.')
        setLoading(false)
      })
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollment || code.length !== 6) return
    setError(null)
    setSubmitting(true)
    try {
      const { access_token } = await mfaChallengeAndVerify(enrollment.id, code)
      setDone(true)
      await completeMfa(access_token)
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err?.message ?? 'Código inválido. Verifique o QR Code e tente novamente.')
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

  if (done) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center space-y-2">
          <ShieldCheck className="size-10 text-green-600 mx-auto" />
          <p className="font-medium">MFA ativado com sucesso!</p>
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
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
        <CardTitle className="text-2xl font-bold">Configurar autenticação de dois fatores</CardTitle>
        <p className="text-sm text-muted-foreground">
          Escaneie o QR Code com o Google Authenticator ou app similar.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && !enrollment && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {enrollment && (
          <>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrollment.totp.qr_code}
                alt="QR Code MFA"
                width={180}
                height={180}
                className="rounded-lg border bg-white p-2"
              />
            </div>

            <div className="rounded-lg bg-slate-50 border px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ou insira a chave manualmente:</p>
              <p className="font-mono text-sm font-semibold tracking-wider break-all">
                {enrollment.totp.secret}
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="totp-verify">Código de verificação</Label>
                <Input
                  id="totp-verify"
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
                {submitting ? 'Ativando...' : 'Ativar MFA'}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  )
}
