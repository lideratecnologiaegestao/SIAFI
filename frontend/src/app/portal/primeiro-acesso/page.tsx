'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { portalApi } from '@/lib/portal/portal-api'

export default function PrimeiroAcessoPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('redirect')
    const destination = r?.startsWith('/') ? r : '/portal'

    portalApi.marcarPrimeiroAcesso()
      .catch(() => {})
      .finally(() => {
        queryClient.setQueryData(['portal-perfil-layout'], (old: any) =>
          old ? { ...old, primeiroAcesso: false } : old,
        )
        router.replace(destination)
      })
  }, [router, queryClient])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 text-center">
      <CheckCircle2 className="size-12 text-green-600" />
      <h1 className="text-xl font-semibold">Bem-vindo ao portal!</h1>
      <p className="text-sm text-muted-foreground">Preparando seu acesso...</p>
      <Loader2 className="size-5 animate-spin text-blue-600" />
    </div>
  )
}
