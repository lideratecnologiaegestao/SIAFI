'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, MessageCircle, CheckCircle2, Building2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { portalApi } from '@/lib/portal/portal-api'
import { SkeletonLine } from '@/components/portal/skeleton-card'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  aberto:     { label: 'Aguardando', color: 'var(--portal-blue-600)', bg: 'var(--portal-blue-100)' },
  respondido: { label: 'Respondido', color: 'var(--portal-green-600)', bg: 'var(--portal-green-100)' },
  fechado:    { label: 'Resolvido',  color: 'var(--portal-gray-600)',  bg: 'var(--portal-gray-100)' },
  resolvido:  { label: 'Resolvido',  color: 'var(--portal-gray-600)',  bg: 'var(--portal-gray-100)' },
}

export default function TicketDetalhePage() {
  const { id } = useParams()
  const ticketId = Number(id)
  const qc = useQueryClient()

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['portal', 'suporte', ticketId],
    queryFn: () => portalApi.getTicket(ticketId),
    enabled: !!ticketId,
  })

  const marcarLido = useMutation({
    mutationFn: () => portalApi.marcarTicketLido(ticketId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'suporte'] }),
  })

  useEffect(() => {
    if (ticket && !ticket.lido) {
      marcarLido.mutate()
    }
  }, [ticket?.id, ticket?.lido]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SkeletonLine width="44px" height="44px" className="skeleton-shimmer" />
          <SkeletonLine width="140px" height="20px" />
        </div>
        <SkeletonLine width="100%" height="80px" />
        <SkeletonLine width="100%" height="120px" />
      </div>
    )
  }

  if (!ticket) return null

  const cfg = STATUS_CFG[ticket.status] ?? STATUS_CFG.aberto

  return (
    <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/portal/suporte" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '8px', border: '1px solid var(--portal-gray-300)', background: 'var(--portal-white)', color: 'var(--portal-gray-600)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Chamado #{ticket.id}
          </h1>
        </div>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '999px',
          background: cfg.bg,
          color: cfg.color,
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'var(--font-dm-sans, sans-serif)',
          whiteSpace: 'nowrap',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Meta info */}
      <div className="pcard" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
          {ticket.assunto}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={12} color="var(--portal-gray-600)" />
          <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Aberto em {formatDate(ticket.createdAt)}
          </p>
        </div>
      </div>

      {/* Thread estilo chat */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Mensagem do cliente (direita) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <MessageCircle size={12} color="var(--portal-gray-600)" />
            <p style={{ fontSize: '11px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Você · {formatDate(ticket.createdAt)}
            </p>
          </div>
          <div style={{
            background: 'var(--portal-blue-600)',
            borderRadius: '12px 12px 2px 12px',
            padding: '14px 16px',
            maxWidth: '85%',
            fontSize: '14px',
            color: '#fff',
            fontFamily: 'var(--font-dm-sans, sans-serif)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>
            {ticket.mensagem}
          </div>
        </div>

        {/* Resposta da Lidera (esquerda) */}
        {ticket.resposta ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Building2 size={12} color="var(--portal-blue-600)" />
              <p style={{ fontSize: '11px', color: 'var(--portal-blue-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', fontWeight: 600 }}>
                Equipe Lidera · {formatDate(ticket.updatedAt)}
              </p>
            </div>
            <div style={{
              background: 'var(--portal-gray-100)',
              borderRadius: '2px 12px 12px 12px',
              padding: '14px 16px',
              maxWidth: '85%',
              fontSize: '14px',
              color: 'var(--portal-gray-950)',
              fontFamily: 'var(--font-dm-sans, sans-serif)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {ticket.resposta}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
              <CheckCircle2 size={12} color="var(--portal-green-600)" />
              <p style={{ fontSize: '11px', color: 'var(--portal-green-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                Respondido em {formatDate(ticket.updatedAt)}
              </p>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '16px',
            borderRadius: '10px',
            border: '1.5px dashed var(--portal-gray-300)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Nossa equipe responderá em breve. ⏳
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
