'use client'

import { useEffect, useRef, useState } from 'react'

interface ProgressBarProps {
  value: number
  color?: 'blue' | 'green' | 'amber' | 'red'
  animated?: boolean
  label?: string
  size?: 'sm' | 'md'
}

const COLOR_MAP: Record<string, string> = {
  blue:  'var(--portal-blue-600)',
  green: 'var(--portal-green-600)',
  amber: 'var(--portal-amber-600)',
  red:   'var(--portal-red-600)',
}

export function ProgressBar({
  value,
  color = 'green',
  animated = true,
  label,
  size = 'md',
}: ProgressBarProps) {
  const [width, setWidth] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    const clamped = Math.min(100, Math.max(0, value))
    if (!mounted.current) {
      mounted.current = true
      const raf = requestAnimationFrame(() => setWidth(clamped))
      return () => cancelAnimationFrame(raf)
    } else {
      setWidth(clamped)
    }
  }, [value])

  return (
    <div>
      {label && (
        <p style={{
          fontSize: '12px',
          color: 'var(--portal-gray-600)',
          marginBottom: '6px',
          fontFamily: 'var(--font-dm-sans, sans-serif)',
        }}>
          {label}
        </p>
      )}
      <div
        style={{
          height: size === 'sm' ? '4px' : '8px',
          background: 'var(--portal-gray-100)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: COLOR_MAP[color],
            borderRadius: '999px',
            transition: animated ? 'width 1000ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        />
      </div>
    </div>
  )
}
