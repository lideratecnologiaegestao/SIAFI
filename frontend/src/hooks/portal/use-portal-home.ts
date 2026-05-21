import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/lib/portal/portal-api'

export function usePortalHome() {
  return useQuery({
    queryKey: ['portal', 'home'],
    queryFn: portalApi.getHome,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
