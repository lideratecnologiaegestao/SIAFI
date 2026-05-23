'use client'

import Link from 'next/link'
import { Plus, MessageCircle, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { usePortalTickets } from '@/hooks/portal/use-portal-suporte'
import { SkeletonTicketCard } from '@/components/portal/skeleton-card'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  aberto: {
    label: 'Aguardando',
    color: 'var(--portal-blue-600)',
    bg: 'var(--portal-blue-100)',
    icon: <Clock size={13} />,
  },
  respondido: {
    label: 'Respondido',
    color: 'var(--portal-green-600)',
    bg: 'var(--portal-green-100)',
    icon: <CheckCircle2 size={13} />,
  },
  fechado: {
    label: 'Resolvido',
    color: 'var(--portal-gray-600)',
    bg: 'var(--portal-gray-100)',
    icon: <CheckCircle2 size={13} />,
  },
  resolvido: {
    label: 'Resolvido',
    color: 'var(--portal-gray-600)',
    bg: 'var(--portal-gray-100)',
    icon: <CheckCircle2 size={13} />,
  },
}

export default function SuportePage() {
  const { data, isLoading } = usePortalTickets()

  return (
    <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Título + botão novo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
          Suporte
        </h1>
        <Link href="/portal/suporte/novo" style={{ textDecoration: 'none' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--portal-blue-600)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'var(--font-dm-sans, sans-serif)',
            cursor: 'pointer',
          }}>
            <Plus size={15} />
            Novo chamado
          </button>
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map(i => <SkeletonTicketCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !data?.length && (
        <div className="pcard" style={{
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--portal-green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={28} color="var(--portal-green-600)" />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '16px', color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Tudo certo!
            </p>
            <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', marginTop: '4px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Sem chamados abertos. Tem alguma dúvida?
            </p>
          </div>
          <Link href="/portal/suporte/novo" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--portal-blue-600)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--font-dm-sans, sans-serif)',
              cursor: 'pointer',
            }}>
              Abrir chamado
            </button>
          </Link>
        </div>
      )}

      {/* Lista de chamados */}
      {!isLoading && data && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.map(t => {
            const cfg = STATUS_CFG[t.status] ?? STATUS_CFG.aberto
            const naoLido = t.status === 'respondido' && !t.lido

            return (
              <Link key={t.id} href={`/portal/suporte/${t.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="pcard-clickable"
                  style={{
                    background: naoLido ? 'var(--portal-blue-100)' : 'var(--portal-white)',
                    borderRadius: 'var(--portal-radius-card)',
                    borderLeft: `4px solid ${naoLido ? 'var(--portal-blue-600)' : cfg.color}`,
                    boxShadow: 'var(--portal-shadow-card)',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      {naoLido && (
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--portal-blue-600)',
                          flexShrink: 0,
                        }} />
                      )}
                      <p style={{
                        fontSize: '14px',
                        fontWeight: naoLido ? 700 : 600,
                        color: 'var(--portal-gray-950)',
                        fontFamily: 'var(--font-dm-sans, sans-serif)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {t.assunto}
                      </p>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                      #{t.id} · {formatDate(t.createdAt)}
                    </p>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: cfg.bg,
                      color: cfg.color,
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-dm-sans, sans-serif)',
                    }}>
                      {cfg.icon}
                      {naoLido ? 'Novo!' : cfg.label}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
