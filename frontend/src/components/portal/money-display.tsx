'use client'

interface MoneyDisplayProps {
  value: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'default' | 'green' | 'red' | 'amber' | 'muted' | 'white'
  showCents?: boolean
  label?: string
  className?: string
}

const SIZE: Record<string, React.CSSProperties> = {
  sm: { fontSize: '16px', fontFamily: 'var(--font-dm-sans, DM Sans, Arial, sans-serif)', fontWeight: 600 },
  md: { fontSize: '20px', fontFamily: 'var(--font-dm-serif, DM Serif Display, Georgia, serif)', fontWeight: 400 },
  lg: { fontSize: '28px', fontFamily: 'var(--font-dm-serif, DM Serif Display, Georgia, serif)', fontWeight: 400 },
  xl: { fontSize: '36px', fontFamily: 'var(--font-dm-serif, DM Serif Display, Georgia, serif)', fontWeight: 400 },
}

const COLOR: Record<string, string> = {
  default: 'var(--portal-gray-950)',
  green:   'var(--portal-green-600)',
  red:     'var(--portal-red-600)',
  amber:   'var(--portal-amber-600)',
  muted:   'var(--portal-gray-600)',
  white:   '#FFFFFF',
}

export function MoneyDisplay({
  value,
  size = 'md',
  color = 'default',
  showCents = true,
  label,
  className,
}: MoneyDisplayProps) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value)

  return (
    <div className={className}>
      {label && (
        <p style={{ fontSize: '11px', color: color === 'white' ? 'rgba(255,255,255,.7)' : 'var(--portal-gray-600)', marginBottom: '2px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
          {label}
        </p>
      )}
      <span
        style={{
          ...SIZE[size],
          color: COLOR[color],
          lineHeight: 1.1,
          display: 'block',
        }}
      >
        {formatted}
      </span>
    </div>
  )
}

/* Loading skeleton para MoneyDisplay */
export function MoneyDisplaySkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const heights: Record<string, string> = { sm: '18px', md: '22px', lg: '30px', xl: '38px' }
  return (
    <div
      className="skeleton-shimmer"
      style={{ height: heights[size], width: '80px', borderRadius: '4px' }}
    />
  )
}
