'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Copy, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth.context'
import { mfaChallengeAndVerify, mfaEnroll, type EnrollResult } from '@/lib/supabase/mfa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { portalApi } from '@/lib/portal/portal-api'

export default function PortalMfaSetupPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<EnrollResult | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login')
    if (!isLoading && user && user.role !== 'cliente') router.replace('/dashboard')
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    mfaEnroll()
      .then(r => { setEnrollment(r); setLoading(false) })
      .catch(e => { setError(e?.message ?? 'Erro ao iniciar configuração.'); setLoading(false) })
  }, [])

  async function copiarSegredo() {
    if (!enrollment) return
    await navigator.clipboard.writeText(enrollment.totp.secret).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollment || code.length !== 6) return
    setError(null)
    setSubmitting(true)
    try {
      await mfaChallengeAndVerify(enrollment.id, code)
      await portalApi.updateMfa(true)
      setDone(true)
      setTimeout(() => router.replace('/portal'), 2000)
    } catch (e: any) {
      setError(e?.message ?? 'Código inválido.')
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading || loading) return (
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
          <h1 className="text-2xl font-bold">Configure o Google Authenticator</h1>
          <p className="text-sm text-muted-foreground">Proteja sua conta com verificação em dois fatores.</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          {done ? (
            <div className="text-center space-y-3 py-4">
              <ShieldCheck className="size-12 text-green-600 mx-auto" />
              <p className="font-semibold text-green-700">Conta protegida!</p>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">1.</span> Instale o Google Authenticator no seu celular.</p>
                <p><span className="font-semibold">2.</span> Escaneie o QR Code abaixo:</p>
              </div>

              {enrollment && (
                <>
                  <div className="flex justify-center">
                    <img
                      src={enrollment.totp.qr_code}
                      alt="QR Code para configurar Google Authenticator"
                      width={180}
                      height={180}
                      className="rounded-lg border bg-white p-2"
                    />
                  </div>

                  <div className="rounded-lg bg-slate-50 border px-3 py-2 space-y-1">
                    <p className="text-xs text-muted-foreground text-center">Ou insira a chave manualmente:</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs font-semibold tracking-wider break-all flex-1 select-all">
                        {enrollment.totp.secret}
                      </p>
                      <button
                        type="button"
                        onClick={copiarSegredo}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Copiar chave manual"
                      >
                        <Copy className="size-4" />
                      </button>
                    </div>
                    {copied && <p className="text-xs text-green-600 text-center">Copiado!</p>}
                  </div>

                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold">3.</span> Digite o código gerado pelo app:</p>
                  </div>

                  <form onSubmit={handleVerify} className="space-y-3">
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
                      aria-label="Código de 6 dígitos do Google Authenticator"
                      disabled={submitting}
                    />
                    {error && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
                      {submitting ? <><Loader2 className="size-4 animate-spin mr-2" />Ativando...</> : 'Ativar proteção →'}
                    </Button>
                  </form>
                </>
              )}

              {error && !enrollment && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => router.replace('/portal')}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Configurar depois
        </button>
      </div>
    </div>
  )
}
