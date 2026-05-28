'use client'

import { useEffect } from 'react'
import { useTema } from '@/hooks/use-tema'

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const { data: tema } = useTema()

  useEffect(() => {
    if (!tema) return

    const r = document.documentElement

    r.style.setProperty('--cor-primaria',       tema.corPrimaria)
    r.style.setProperty('--cor-secundaria',     tema.corSecundaria)
    r.style.setProperty('--cor-acento',         tema.corAcento)
    r.style.setProperty('--cor-texto',          tema.corTexto)
    r.style.setProperty('--cor-fundo',          tema.corFundo)

    r.style.setProperty('--cor-primaria-hover',  escurecer(tema.corPrimaria, 12))
    r.style.setProperty('--cor-primaria-light',  clarear(tema.corPrimaria, 42))
    r.style.setProperty('--cor-primaria-sutil',  hexOpacidade(tema.corPrimaria, 0.10))
    r.style.setProperty('--cor-primaria-borda',  hexOpacidade(tema.corPrimaria, 0.30))

    // Sobrescreve variáveis do shadcn/ui para compatibilidade
    r.style.setProperty('--primary',         tema.corPrimaria)
    r.style.setProperty('--ring',            tema.corPrimaria)
    r.style.setProperty('--sidebar-primary', tema.corPrimaria)

    document.title = `${tema.nomeFantasia} — SIAFI`
  }, [tema])

  return <>{children}</>
}

// ── Helpers de cor ────────────────────────────────────────────────────────────

function hexParaRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbParaHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, v))
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
}

function escurecer(hex: string, amount: number): string {
  const [r, g, b] = hexParaRgb(hex)
  return rgbParaHex(r - amount, g - amount, b - amount)
}

function clarear(hex: string, amount: number): string {
  const [r, g, b] = hexParaRgb(hex)
  return rgbParaHex(r + amount, g + amount, b + amount)
}

function hexOpacidade(hex: string, alpha: number): string {
  const [r, g, b] = hexParaRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
