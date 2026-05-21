import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ['mensagens-badge'],
    queryFn: () => api.get<{ count: number }>('/mensagens/badge').then(r => r.data.count),
    refetchInterval: 30_000,
    staleTime:       20_000,
  })
  return data ?? 0
}
