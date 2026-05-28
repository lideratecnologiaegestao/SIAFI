'use client'

interface ScoreIndicatorProps {
  score: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}

function getColor(score: number): string {
  if (score <= 20) return '#DC2626'
  if (score <= 40) return '#EA580C'
  if (score <= 60) return '#D97706'
  if (score <= 80) return '#65A30D'
  return '#059669'
}

function getLabel(score: number): string {
  if (score <= 20) return 'Ruim'
  if (score <= 40) return 'Regular'
  if (score <= 60) return 'Médio'
  if (score <= 80) return 'Muito bom'
  return 'Excelente'
}

export function ScoreIndicator({ score, showLabel = true, size = 'md' }: ScoreIndicatorProps) {
  const color = getColor(score)
  const label = getLabel(score)
  const filled = Math.round((score / 100) * 5)
  const dotSize = size === 'sm' ? '10px' : '13px'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: i <= filled ? color : 'rgba(255,255,255,.25)',
              transition: 'background 300ms ease',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span style={{
          fontSize: size === 'sm' ? '12px' : '13px',
          color: 'rgba(255,255,255,.9)',
          fontWeight: 500,
          fontFamily: 'var(--font-dm-sans, sans-serif)',
        }}>
          {label}
        </span>
      )}
    </div>
  )
}

/* Versão para fundo claro (ex: perfil page) */
export function ScoreIndicatorLight({ score, showLabel = true }: ScoreIndicatorProps) {
  const color = getColor(score)
  const label = getLabel(score)
  const filled = Math.round((score / 100) * 5)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              background: i <= filled ? color : 'var(--portal-gray-300)',
              transition: 'background 300ms ease',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span style={{
          fontSize: '13px',
          color,
          fontWeight: 600,
          fontFamily: 'var(--font-dm-sans, sans-serif)',
        }}>
          {label}
        </span>
      )}
    </div>
  )
}
