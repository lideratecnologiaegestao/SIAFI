import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/lib/portal/portal-api'

export function usePortalContratos() {
  return useQuery({
    queryKey: ['portal', 'contratos'],
    queryFn: portalApi.getContratos,
    staleTime: 60_000,
  })
}

export function usePortalContrato(id: number) {
  return useQuery({
    queryKey: ['portal', 'contratos', id],
    queryFn: () => portalApi.getContrato(id),
    enabled: !!id,
    staleTime: 60_000,
  })
}
