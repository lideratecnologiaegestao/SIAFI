'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, Loader2, Share2, RefreshCw, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { usePortalPix } from '@/hooks/portal/use-portal-pix'

function formatTimeLeft(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PixPage() {
  const { installmentId } = useParams()
  const { pixData, fase, timeLeft, regenerar } = usePortalPix(Number(installmentId))
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (!pixData?.qrCode) return
    try { await navigator.clipboard.writeText(pixData.qrCode) } catch {}
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  async function compartilhar() {
    if (!pixData?.qrCode) return
    if (navigator.share) {
      await navigator.share({ title: 'Pagamento PIX SIAFI', text: pixData.qrCode }).catch(() => {})
    } else {
      await copiar()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal/contratos">
          <button className="text-muted-foreground hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <h1 className="text-xl font-bold">Pagar com PIX</h1>
      </div>

      {fase === 'carregando' && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Loader2 className="size-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
          </CardContent>
        </Card>
      )}

      {fase === 'erro' && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-destructive font-medium">Erro ao gerar o PIX</p>
            <Button variant="outline" onClick={regenerar} className="gap-2">
              <RefreshCw className="size-4" />Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {fase === 'expirado' && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="size-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <Clock className="size-8 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold">QR Code expirado</p>
              {pixData && (
                <p className="text-sm text-muted-foreground mt-1">
                  O código PIX de {formatCurrency(pixData.valor)} expirou.
                </p>
              )}
            </div>
            <Button onClick={regenerar} className="gap-2">
              <RefreshCw className="size-4" />Gerar novo QR Code
            </Button>
          </CardContent>
        </Card>
      )}

      {fase === 'sucesso' && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto" style={{ animation: 'scale-in 0.3s ease-out' }}>
              <Check className="size-8 text-green-600" />
            </div>
            <div aria-live="assertive">
              <p className="text-lg font-semibold text-green-700">Pagamento confirmado!</p>
              {pixData && (
                <p className="text-sm text-muted-foreground mt-1">{formatCurrency(pixData.valor)} recebido com sucesso.</p>
              )}
            </div>
            <Link href="/portal/contratos">
              <Button className="mt-2">Ver meus contratos</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {fase === 'qrcode' && pixData && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Valor a pagar</p>
                <p className="text-3xl font-bold">{formatCurrency(pixData.valor)}</p>
              </div>

              {pixData.qrImage && (
                <div className="flex justify-center">
                  <img
                    src={pixData.qrImage}
                    alt={`QR Code PIX para pagamento de ${formatCurrency(pixData.valor)}`}
                    className="size-56 rounded-xl border bg-white p-2"
                  />
                </div>
              )}

              {timeLeft !== null && timeLeft > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5" />
                  Válido por {formatTimeLeft(timeLeft)}
                </div>
              )}
            </CardContent>
          </Card>

          {pixData.qrCode && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Copia e cola PIX:</p>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs font-mono break-all select-all text-muted-foreground">
                {pixData.qrCode}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={copiar} variant="outline" aria-label="Copiar código PIX">
                  {copiado ? <><Check className="size-4" />Copiado!</> : <><Copy className="size-4" />Copiar</>}
                </Button>
                <Button className="flex-1 gap-2" onClick={compartilhar} variant="outline" aria-label="Compartilhar código PIX">
                  <Share2 className="size-4" />Compartilhar
                </Button>
                <Button variant="outline" onClick={regenerar} aria-label="Gerar novo QR Code" className="w-10 px-0">
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center" role="status">
            <Loader2 className="size-3 animate-spin" />
            Aguardando confirmação automática...
          </div>
        </div>
      )}
    </div>
  )
}
