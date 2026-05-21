import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/lib/portal/portal-api'

export function usePortalTickets() {
  return useQuery({
    queryKey: ['portal', 'suporte'],
    queryFn: portalApi.getTickets,
    staleTime: 30_000,
  })
}

export function usePortalTicket(id: number) {
  return useQuery({
    queryKey: ['portal', 'suporte', id],
    queryFn: () => portalApi.getTicket(id),
    enabled: !!id,
  })
}
