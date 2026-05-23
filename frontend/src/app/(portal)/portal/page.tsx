'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertTriangle, Clock, ShieldAlert, FileSignature, ChevronRight, QrCode, CheckCircle2 } from 'lucide-react'
import { portalClient } from '@/lib/portal/portal-client'
import { usePortalAuth } from '@/contexts/portal-auth.context'
import { MoneyDisplay, MoneyDisplaySkeleton } from '@/components/portal/money-display'
import { ProgressBar } from '@/components/portal/progress-bar'
import { LoanStatusBadge } from '@/components/portal/status-badges'
import { ScoreIndicator } from '@/components/portal/score-indicator'
import { SkeletonHero, SkeletonContractCard, SkeletonListItem } from '@/components/portal/skeleton-card'

interface Alerta {
  tipo: 'atrasado' | 'vencendo' | 'em_dia' | 'mfa'
  mensagem: string
  loanId?: number
  installmentId?: number
}

interface ContratoPendente {
  id: number
  valor: number
  numeroParcelas: number
  aceiteExpiraEm: string | null
}

interface ContratoAtivo {
  id: number
  valor: number
  numeroParcelas: number
  dataInicio: string
  status: string
  percentualPago: number
  totalPago: number
  proximaParcela: { id: number; valor: number; dataVencimento: string } | null
}

interface UltimoPagamento {
  id: number
  valor: number
  dataPagamento: string
  metodoPagamento: string
  numeroParcela: number
  loanId: number
}

interface HomeData {
  contratosAtivos: number
  contratosPendentesAceite?: ContratoPendente[]
  contratosAtivosLista?: ContratoAtivo[]
  proximaParcela: { valor: number; dataVencimento: string; installmentId: number } | null
  totalEmAberto: number
  ultimosPagamentos: UltimoPagamento[]
  alerta: Alerta | null
  score?: number
}

const METODOS: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão',
  transferencia: 'Transferência', cheque: 'Cheque', mercadopago: 'Mercado Pago',
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR')
}

function getProgressColor(status: string, proximaData?: string): 'green' | 'amber' | 'red' {
  if (status === 'inadimplente') return 'red'
  if (!proximaData) return 'green'
  const dias = Math.floor((new Date(proximaData).getTime() - Date.now()) / 86_400_000)
  if (dias < 0) return 'red'
  if (dias <= 5) return 'amber'
  return 'green'
}

export default function PortalHomePage() {
  const { user } = usePortalAuth()
  const { data, isLoading } = useQuery<HomeData>({
    queryKey: ['portal-home'],
    queryFn: () => portalClient.get('/portal/home').then(r => r.data),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })

  const primeiroNome = user?.nome?.split(' ')[0] ?? ''

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SkeletonHero />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2].map(i => <SkeletonContractCard key={i} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[1, 2, 3].map(i => <SkeletonListItem key={i} />)}
        </div>
      </div>
    )
  }

  const d = data

  return (
    <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Hero Card ─────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--portal-blue-900) 0%, var(--portal-blue-800) 100%)',
          borderRadius: 'var(--portal-radius-card)',
          padding: '24px',
          boxShadow: 'var(--portal-shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Saudação */}
        <div>
          <p style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#FFFFFF',
            fontFamily: 'var(--font-dm-sans, sans-serif)',
            lineHeight: 1.2,
          }}>
            Olá, {primeiroNome}! 👋
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.6)', marginTop: '2px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            {d?.alerta?.tipo === 'em_dia' || !d?.alerta
              ? 'Tudo em dia com seus contratos.'
              : 'Veja o alerta abaixo sobre seus contratos.'}
          </p>
        </div>

        {/* Mini-cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: '10px', padding: '14px' }}>
            <MoneyDisplay
              value={d?.totalEmAberto ?? 0}
              size="md"
              color="white"
              label="Total em aberto"
            />
          </div>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: '10px', padding: '14px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)', marginBottom: '2px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Contratos ativos
            </p>
            <p style={{
              fontSize: '20px',
              fontFamily: 'var(--font-dm-serif, Georgia, serif)',
              color: '#FFFFFF',
              lineHeight: 1.1,
            }}>
              {d?.contratosAtivos ?? 0}
            </p>
          </div>
        </div>

        {/* Score — exibido apenas quando disponível */}
        {d?.score !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.6)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Score de pontualidade:
            </p>
            <ScoreIndicator score={d.score} size="sm" />
          </div>
        )}
      </div>

      {/* ── Contratos aguardando aceite ───────────────── */}
      {d?.contratosPendentesAceite?.map(c => (
        <Link key={c.id} href={`/portal/contratos/${c.id}`} style={{ textDecoration: 'none' }}>
          <div
            style={{
              background: 'var(--portal-amber-100)',
              border: '2px solid var(--portal-amber-600)',
              borderRadius: 'var(--portal-radius-card)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--portal-shadow-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSignature size={18} color="var(--portal-amber-600)" />
              <p style={{ fontWeight: 600, color: 'var(--portal-amber-600)', fontSize: '14px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                Proposta aguardando sua assinatura
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                  {fmtCurrency(c.valor)} · {c.numeroParcelas} parcelas
                </p>
                {c.aceiteExpiraEm && (
                  <p style={{ fontSize: '11px', color: 'var(--portal-amber-600)', marginTop: '2px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                    Prazo: {fmtDate(c.aceiteExpiraEm)}
                  </p>
                )}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--portal-amber-600)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans, sans-serif)',
                whiteSpace: 'nowrap',
              }}>
                Assinar →
              </div>
            </div>
          </div>
        </Link>
      ))}

      {/* ── Alerta (atrasado / vencendo / mfa) ───────── */}
      {d?.alerta && d.alerta.tipo !== 'em_dia' && (
        <div style={{
          background: d.alerta.tipo === 'atrasado' ? 'var(--portal-red-100)'
            : d.alerta.tipo === 'mfa' ? 'var(--portal-blue-100)'
            : 'var(--portal-amber-100)',
          border: `1px solid ${d.alerta.tipo === 'atrasado' ? 'var(--portal-red-600)'
            : d.alerta.tipo === 'mfa' ? 'var(--portal-blue-400)'
            : 'var(--portal-amber-600)'}`,
          borderRadius: 'var(--portal-radius-card)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          boxShadow: 'var(--portal-shadow-card)',
        }}>
          {d.alerta.tipo === 'atrasado' ? <AlertTriangle size={18} color="var(--portal-red-600)" style={{ flexShrink: 0, marginTop: 1 }} />
            : d.alerta.tipo === 'mfa' ? <ShieldAlert size={18} color="var(--portal-blue-600)" style={{ flexShrink: 0, marginTop: 1 }} />
            : <Clock size={18} color="var(--portal-amber-600)" style={{ flexShrink: 0, marginTop: 1 }} />
          }
          <div style={{ flex: 1 }}>
            <p style={{
              fontSize: '13px',
              color: d.alerta.tipo === 'atrasado' ? 'var(--portal-red-600)'
                : d.alerta.tipo === 'mfa' ? 'var(--portal-blue-600)'
                : 'var(--portal-amber-600)',
              fontFamily: 'var(--font-dm-sans, sans-serif)',
              fontWeight: 500,
            }}>
              {d.alerta.mensagem}
            </p>
            {d.alerta.loanId && (
              <Link href={`/portal/contratos/${d.alerta.loanId}`} style={{
                fontSize: '12px',
                color: 'var(--portal-blue-600)',
                textDecoration: 'underline',
                marginTop: '4px',
                display: 'block',
                fontFamily: 'var(--font-dm-sans, sans-serif)',
              }}>
                Ver contrato →
              </Link>
            )}
            {d.alerta.tipo === 'mfa' && (
              <Link href="/portal/mfa-setup" style={{
                fontSize: '12px',
                color: 'var(--portal-blue-600)',
                textDecoration: 'underline',
                marginTop: '4px',
                display: 'block',
                fontFamily: 'var(--font-dm-sans, sans-serif)',
              }}>
                Configurar autenticação →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Próxima parcela (CTA rápido) ─────────────── */}
      {d?.proximaParcela && (
        <div
          style={{
            background: 'var(--portal-white)',
            borderRadius: 'var(--portal-radius-card)',
            padding: '16px 20px',
            boxShadow: 'var(--portal-shadow-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <p style={{ fontSize: '11px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginBottom: '2px' }}>
              Próxima parcela
            </p>
            <MoneyDisplay value={d.proximaParcela.valor} size="lg" />
            <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', marginTop: '3px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Vence {fmtDate(d.proximaParcela.dataVencimento)}
            </p>
          </div>
          <Link href={`/portal/pagamentos/pix/${d.proximaParcela.installmentId}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--portal-blue-600)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--font-dm-sans, sans-serif)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
              <QrCode size={16} />
              Pagar PIX
            </button>
          </Link>
        </div>
      )}

      {/* ── Contratos ativos ─────────────────────────── */}
      {d?.contratosAtivosLista && d.contratosAtivosLista.length > 0 && (
        <div>
          <p style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--portal-gray-800)',
            marginBottom: '10px',
            fontFamily: 'var(--font-dm-sans, sans-serif)',
          }}>
            Meus contratos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {d.contratosAtivosLista.map((c, idx) => {
              const progColor = getProgressColor(c.status, c.proximaParcela?.dataVencimento)
              return (
                <Link key={c.id} href={`/portal/contratos/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div className="pcard pcard-clickable" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                        Contrato {idx + 1}
                      </p>
                      <LoanStatusBadge status={c.status} />
                    </div>
                    <MoneyDisplay value={c.valor} size="md" label="Valor emprestado" />
                    <ProgressBar
                      value={c.percentualPago}
                      color={progColor}
                      animated
                      label={`${c.percentualPago}% pago · ${Math.round((c.percentualPago / 100) * c.numeroParcelas)} de ${c.numeroParcelas} parcelas`}
                    />
                    {c.proximaParcela && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--portal-gray-100)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                          Próximo vencimento: {fmtDate(c.proximaParcela.dataVencimento)}
                        </p>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                          {fmtCurrency(c.proximaParcela.valor)}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Empty state (sem contratos) ───────────────── */}
      {!isLoading && d?.contratosAtivos === 0 && (
        <div style={{
          background: 'var(--portal-white)',
          borderRadius: 'var(--portal-radius-card)',
          padding: '40px 24px',
          boxShadow: 'var(--portal-shadow-card)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <FileSignature size={36} color="var(--portal-gray-300)" />
          <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Nenhum contrato ativo
          </p>
          <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Fale com seu consultor para iniciar um novo contrato.
          </p>
        </div>
      )}

      {/* ── Últimos pagamentos ────────────────────────── */}
      {d?.ultimosPagamentos && d.ultimosPagamentos.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Últimos pagamentos
            </p>
            <Link href="/portal/pagamentos" style={{ fontSize: '12px', color: 'var(--portal-blue-600)', textDecoration: 'none', fontFamily: 'var(--font-dm-sans, sans-serif)', fontWeight: 500 }}>
              Ver todos →
            </Link>
          </div>
          <div style={{ background: 'var(--portal-white)', borderRadius: 'var(--portal-radius-card)', boxShadow: 'var(--portal-shadow-card)', overflow: 'hidden' }}>
            {d.ultimosPagamentos.slice(0, 4).map((p, idx) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: idx < Math.min(d.ultimosPagamentos.length, 4) - 1 ? '1px solid var(--portal-gray-100)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--portal-green-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CheckCircle2 size={16} color="var(--portal-green-600)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                      Parcela {p.numeroParcela}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                      {fmtDate(p.dataPagamento)} · {METODOS[p.metodoPagamento] ?? p.metodoPagamento}
                    </p>
                  </div>
                </div>
                <MoneyDisplay value={p.valor} size="sm" color="green" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
