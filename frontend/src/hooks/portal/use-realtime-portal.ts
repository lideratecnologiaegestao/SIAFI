import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export interface PortalNotificacao {
  tipo: 'ticket_respondido' | 'pagamento_confirmado'
  ticketId?: number
  assunto?: string
}

export function useRealtimePortal(clientId: number | undefined) {
  const [notificacoes, setNotificacoes] = useState<PortalNotificacao[]>([])
  const qc = useQueryClient()
  const loanIdsRef = useRef<Set<number>>(new Set())

  // Collect loan IDs when contracts query resolves
  const updateLoanIds = useCallback((ids: number[]) => {
    loanIdsRef.current = new Set(ids)
  }, [])

  useEffect(() => {
    if (!clientId) return

    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`portal-${clientId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `client_id=eq.${clientId}`,
        },
        (payload: any) => {
          if (payload.new?.status === 'respondido') {
            setNotificacoes(prev => [...prev, {
              tipo: 'ticket_respondido',
              ticketId: payload.new.id,
              assunto: payload.new.assunto,
            }])
            qc.invalidateQueries({ queryKey: ['portal', 'suporte'] })
          }
        },
      )
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payments',
        },
        (payload: any) => {
          if (!loanIdsRef.current.has(payload.new?.loan_id)) return
          setNotificacoes(prev => [...prev, { tipo: 'pagamento_confirmado' }])
          qc.invalidateQueries({ queryKey: ['portal', 'home'] })
          qc.invalidateQueries({ queryKey: ['portal', 'contratos'] })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clientId, qc])

  const limparNotificacoes = useCallback(() => setNotificacoes([]), [])

  return { notificacoes, limparNotificacoes, updateLoanIds }
}
