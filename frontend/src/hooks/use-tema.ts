import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Tema {
  logoUrl:       string
  nomeFantasia:  string
  corPrimaria:   string
  corSecundaria: string
  corAcento:     string
  corTexto:      string
  corFundo:      string
}

export function useTema() {
  return useQuery<Tema>({
    queryKey: ['empresa-tema'],
    queryFn:  () => api.get('/empresa/tema').then(r => r.data),
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  })
}
