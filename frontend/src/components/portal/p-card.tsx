'use client'

import { CSSProperties, ReactNode } from 'react'

type AccentColor = 'blue' | 'green' | 'amber' | 'red' | 'none'

interface PCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  elevated?: boolean
  accent?: AccentColor
  style?: CSSProperties
  noPadding?: boolean
}

const ACCENT_BORDER: Record<AccentColor, string> = {
  blue:  '2px solid var(--portal-blue-400)',
  green: '2px solid var(--portal-green-400)',
  amber: '2px solid var(--portal-amber-600)',
  red:   '2px solid var(--portal-red-600)',
  none:  'none',
}

const ACCENT_BG: Record<AccentColor, string> = {
  blue:  'var(--portal-blue-100)',
  green: 'var(--portal-green-100)',
  amber: 'var(--portal-amber-100)',
  red:   'var(--portal-red-100)',
  none:  'var(--portal-white)',
}

export function PCard({
  children,
  className,
  onClick,
  elevated = false,
  accent = 'none',
  style,
  noPadding = false,
}: PCardProps) {
  const isClickable = !!onClick

  return (
    <div
      onClick={onClick}
      className={[
        'pcard',
        isClickable ? 'pcard-clickable' : '',
        className ?? '',
      ].join(' ')}
      style={{
        border: ACCENT_BORDER[accent],
        background: accent !== 'none' ? ACCENT_BG[accent] : 'var(--portal-white)',
        boxShadow: elevated
          ? 'var(--portal-shadow-elevated)'
          : 'var(--portal-shadow-card)',
        padding: noPadding ? 0 : '20px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
