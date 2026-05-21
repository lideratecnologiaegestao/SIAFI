'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { portalApi } from '@/lib/portal/portal-api'

const STATUS_TICKET: Record<string, { label: string; variant: 'outline' | 'secondary' | 'success' | 'destructive' }> = {
  aberto: { label: 'Aguardando', variant: 'outline' },
  respondido: { label: 'Respondido', variant: 'secondary' },
  fechado: { label: 'Resolvido', variant: 'success' },
  resolvido: { label: 'Resolvido', variant: 'success' },
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

  // Auto-mark as read when ticket is loaded and unread
  useEffect(() => {
    if (ticket && !ticket.lido) {
      marcarLido.mutate()
    }
  }, [ticket?.id, ticket?.lido]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!ticket) return null

  const st = STATUS_TICKET[ticket.status] ?? { label: ticket.status, variant: 'outline' as const }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal/suporte">
          <button className="text-muted-foreground hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Ticket #{ticket.id}</h1>
        </div>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>

      {/* Assunto e metadata */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Assunto</p>
            <p className="font-semibold">{ticket.assunto}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            Aberto em {formatDate(ticket.createdAt)}
          </div>
        </CardContent>
      </Card>

      {/* Mensagem do cliente */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <MessageSquare className="size-3.5" />Sua mensagem
        </p>
        <div className="bg-white rounded-xl border px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
          {ticket.mensagem}
        </div>
      </div>

      {/* Resposta da equipe */}
      {ticket.resposta ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-blue-600" />Resposta da equipe Lidera
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
            {ticket.resposta}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Respondido em {formatDate(ticket.updatedAt)}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          Nossa equipe responderá em breve.
        </div>
      )}
    </div>
  )
}
