import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { portalApi } from '@/lib/portal/portal-api'
import type { PortalPixData } from '@/lib/portal/portal-types'

type PixFase = 'carregando' | 'qrcode' | 'sucesso' | 'expirado' | 'erro'

export function usePortalPix(installmentId: number) {
  const [pixData, setPixData] = useState<PortalPixData | null>(null)
  const [fase, setFase] = useState<PixFase>('carregando')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qc = useQueryClient()

  const clearPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const iniciarTimer = useCallback((expiresAt: string) => {
    clearTimer()
    timerRef.current = setInterval(() => {
      const secs = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      if (secs <= 0) {
        clearPolling()
        clearTimer()
        setFase('expirado')
        setTimeLeft(0)
      } else {
        setTimeLeft(secs)
      }
    }, 1000)
  }, [clearPolling, clearTimer])

  const iniciarPolling = useCallback((pixId: number) => {
    clearPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const s = await portalApi.getPixStatus(pixId)
        if (s.status === 'aprovado') {
          clearPolling()
          clearTimer()
          setFase('sucesso')
          qc.invalidateQueries({ queryKey: ['portal', 'home'] })
          qc.invalidateQueries({ queryKey: ['portal', 'contratos'] })
        } else if (s.status === 'expirado' || s.status === 'cancelado') {
          clearPolling()
          clearTimer()
          setFase('expirado')
        }
      } catch {}
    }, 10_000)
  }, [clearPolling, clearTimer, qc])

  const iniciar = useCallback(async () => {
    clearPolling()
    clearTimer()
    setFase('carregando')
    setPixData(null)
    try {
      const data = await portalApi.gerarPix(installmentId)
      setPixData(data)
      setFase('qrcode')
      if (data.expiresAt) iniciarTimer(data.expiresAt)
      iniciarPolling(data.pixId)
    } catch {
      setFase('erro')
    }
  }, [installmentId, iniciarPolling, iniciarTimer, clearPolling, clearTimer])

  useEffect(() => {
    iniciar()
    return () => { clearPolling(); clearTimer() }
  }, [iniciar, clearPolling, clearTimer])

  return { pixData, fase, timeLeft, regenerar: iniciar }
}
