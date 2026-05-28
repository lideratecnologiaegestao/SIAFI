'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Share2, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { usePortalPix } from '@/hooks/portal/use-portal-pix'
import { PIXCopyButton } from '@/components/portal/pix-copy-button'
import { MoneyDisplay } from '@/components/portal/money-display'

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatTimeLeft(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/* Stepper visual */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Confirmar', 'QR Code', 'Pronto!']
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', marginBottom: '4px' }}>
      {steps.map((label, i) => {
        const num = i + 1
        const done = step > num
        const active = step === num
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: done ? 'var(--portal-green-600)' : active ? 'var(--portal-blue-600)' : 'var(--portal-gray-100)',
                color: done || active ? '#fff' : 'var(--portal-gray-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-dm-sans, sans-serif)',
                transition: 'background 300ms ease',
              }}>
                {done ? <CheckCircle2 size={15} /> : num}
              </div>
              <span style={{
                fontSize: '10px',
                color: active ? 'var(--portal-blue-600)' : done ? 'var(--portal-green-600)' : 'var(--portal-gray-600)',
                fontWeight: active ? 600 : 400,
                fontFamily: 'var(--font-dm-sans, sans-serif)',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: '48px',
                height: '2px',
                background: done ? 'var(--portal-green-600)' : 'var(--portal-gray-100)',
                margin: '0 4px',
                marginBottom: '18px',
                transition: 'background 300ms ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PixPage() {
  const { installmentId } = useParams()
  const { pixData, fase, timeLeft, regenerar } = usePortalPix(Number(installmentId))
  const [compartilhando, setCompartilhando] = useState(false)

  async function handleCompartilhar() {
    if (!pixData?.qrCode) return
    setCompartilhando(true)
    if (navigator.share) {
      await navigator.share({ title: 'Pagamento PIX', text: pixData.qrCode }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(pixData.qrCode).catch(() => {})
    }
    setCompartilhando(false)
  }

  const currentStep: 1 | 2 | 3 =
    fase === 'sucesso' ? 3 :
    fase === 'qrcode' ? 2 : 1

  return (
    <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/portal/contratos" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '8px', border: '1px solid var(--portal-gray-300)', background: 'var(--portal-white)', color: 'var(--portal-gray-600)' }}>
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
          Pagar com PIX
        </h1>
      </div>

      {/* Stepper */}
      {fase !== 'erro' && fase !== 'expirado' && (
        <Stepper step={currentStep} />
      )}

      {/* ── Carregando ─────────────────────────────────── */}
      {fase === 'carregando' && (
        <div className="pcard" style={{
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid var(--portal-blue-100)',
            borderTopColor: 'var(--portal-blue-600)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: '14px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Gerando QR Code PIX...
          </p>
        </div>
      )}

      {/* ── Erro ──────────────────────────────────────── */}
      {fase === 'erro' && (
        <div className="pcard" style={{
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--portal-red-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={28} color="var(--portal-red-600)" />
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Não foi possível gerar o PIX
            </p>
            <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', marginTop: '4px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Tente novamente ou entre em contato com o suporte.
            </p>
          </div>
          <button onClick={regenerar} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '12px 24px',
            borderRadius: '8px',
            border: '1px solid var(--portal-gray-300)',
            background: 'var(--portal-white)',
            color: 'var(--portal-gray-800)',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'var(--font-dm-sans, sans-serif)',
            cursor: 'pointer',
          }}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Expirado ──────────────────────────────────── */}
      {fase === 'expirado' && (
        <div className="pcard" style={{
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--portal-amber-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={28} color="var(--portal-amber-600)" />
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              QR Code expirado
            </p>
            {pixData && (
              <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', marginTop: '4px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                O código PIX de {fmtCurrency(pixData.valor)} expirou.
              </p>
            )}
          </div>
          <button onClick={regenerar} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--portal-blue-600)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'var(--font-dm-sans, sans-serif)',
            cursor: 'pointer',
          }}>
            <RefreshCw size={16} />
            Gerar novo QR Code
          </button>
        </div>
      )}

      {/* ── Sucesso ───────────────────────────────────── */}
      {fase === 'sucesso' && pixData && (
        <div className="pcard" style={{
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center',
        }}>
          <div
            className="animate-check-bounce"
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'var(--portal-green-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={40} color="var(--portal-green-600)" />
          </div>

          <div>
            <p style={{ fontWeight: 700, fontSize: '20px', color: 'var(--portal-green-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginBottom: '8px' }}>
              Pagamento confirmado!
            </p>
            <MoneyDisplay value={pixData.valor} size="xl" color="green" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <Link href="/portal/contratos" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--portal-blue-600)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans, sans-serif)',
                cursor: 'pointer',
              }}>
                Ver meus contratos
              </button>
            </Link>
            <Link href="/portal" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--portal-gray-300)',
                background: 'var(--portal-white)',
                color: 'var(--portal-gray-600)',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: 'var(--font-dm-sans, sans-serif)',
                cursor: 'pointer',
              }}>
                Voltar ao início
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* ── QR Code ───────────────────────────────────── */}
      {fase === 'qrcode' && pixData && (
        <>
          {/* Card valor */}
          <div className="pcard" style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginBottom: '6px' }}>
              Total a pagar
            </p>
            <MoneyDisplay value={pixData.valor} size="xl" />

            {timeLeft !== null && timeLeft > 0 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
                padding: '6px 12px',
                borderRadius: '999px',
                background: timeLeft < 120 ? 'var(--portal-red-100)' : 'var(--portal-gray-100)',
              }}>
                <Clock size={14} color={timeLeft < 120 ? 'var(--portal-red-600)' : 'var(--portal-gray-600)'} />
                <span style={{
                  fontFamily: 'var(--font-jetbrains, monospace)',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: timeLeft < 120 ? 'var(--portal-red-600)' : 'var(--portal-gray-600)',
                }}>
                  {formatTimeLeft(timeLeft)}
                </span>
              </div>
            )}
          </div>

          {/* QR Code */}
          {pixData.qrImage && (
            <div className="pcard" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                Escaneie com o app do seu banco
              </p>
              <img
                src={`data:image/png;base64,${pixData.qrImage}`}
                alt="QR Code PIX"
                style={{
                  width: '220px',
                  height: '220px',
                  borderRadius: '12px',
                  border: '2px solid var(--portal-gray-100)',
                  background: '#fff',
                  padding: '8px',
                }}
              />
            </div>
          )}

          {/* Código copia-e-cola */}
          {pixData.qrCode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                Ou use o código PIX Copia e Cola:
              </p>
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--portal-gray-300)',
                background: 'var(--portal-gray-100)',
                fontFamily: 'var(--font-jetbrains, monospace)',
                fontSize: '11px',
                color: 'var(--portal-gray-800)',
                wordBreak: 'break-all',
                lineHeight: 1.6,
                maxHeight: '80px',
                overflow: 'hidden',
                userSelect: 'all',
              }}>
                {pixData.qrCode}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <PIXCopyButton code={pixData.qrCode} />
                </div>
                <button
                  onClick={handleCompartilhar}
                  disabled={compartilhando}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--portal-gray-300)',
                    background: 'var(--portal-white)',
                    color: 'var(--portal-gray-800)',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-dm-sans, sans-serif)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  aria-label="Compartilhar"
                >
                  <Share2 size={16} />
                </button>
                <button
                  onClick={regenerar}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--portal-gray-300)',
                    background: 'var(--portal-white)',
                    color: 'var(--portal-gray-600)',
                    cursor: 'pointer',
                  }}
                  aria-label="Gerar novo QR Code"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Aguardando confirmação */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--portal-blue-100)',
          }}>
            <Loader2 size={16} color="var(--portal-blue-600)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px', color: 'var(--portal-blue-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', fontWeight: 500 }}>
              Aguardando confirmação do pagamento...
            </p>
          </div>
        </>
      )}
    </div>
  )
}
