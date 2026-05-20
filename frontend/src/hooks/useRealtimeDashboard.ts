'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { tokenStore } from '@/lib/api'

/**
 * Subscribes to Supabase Realtime postgres_changes on payments, installments
 * and transactions. On any event, invalidates the relevant React Query keys so
 * the dashboard refreshes automatically without polling.
 */
export function useRealtimeDashboard() {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)
  // Prevent React StrictMode double-subscribe from creating duplicate channels
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null)

  useEffect(() => {
    if (channelRef.current) return

    const supabase = getSupabaseBrowserClient()

    // Authenticate the Realtime connection with the user's token
    const token = tokenStore.get()
    if (token) {
      supabase.realtime.setAuth(token)
    }

    const channel = supabase
      .channel('siafi-dashboard')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        () => {
          qc.invalidateQueries({ queryKey: ['loans', 'stats'] })
          qc.invalidateQueries({ queryKey: ['clients', 'stats'] })
          qc.invalidateQueries({ queryKey: ['clients', 'quitados'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'installments' },
        () => {
          qc.invalidateQueries({ queryKey: ['installments', 'overdue'] })
          qc.invalidateQueries({ queryKey: ['clients', 'stats'] })
          qc.invalidateQueries({ queryKey: ['loans', 'stats'] })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        () => {
          qc.invalidateQueries({ queryKey: ['transactions'] })
        },
      )
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setConnected(false)
    }
  }, [qc])

  return { connected }
}
