'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface PIXCopyButtonProps {
  code: string
  onCopy?: () => void
  className?: string
}

export function PIXCopyButton({ code, onCopy, className }: PIXCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }

    if (navigator.vibrate) navigator.vibrate(50)
    setCopied(true)
    onCopy?.()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 20px',
        borderRadius: '8px',
        border: `1px solid ${copied ? 'var(--portal-green-400)' : 'var(--portal-gray-300)'}`,
        background: copied ? 'var(--portal-green-100)' : 'var(--portal-white)',
        color: copied ? 'var(--portal-green-600)' : 'var(--portal-gray-800)',
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: 'var(--font-dm-sans, sans-serif)',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        width: '100%',
        justifyContent: 'center',
      }}
      aria-label={copied ? 'Código copiado!' : 'Copiar código PIX'}
    >
      {copied ? (
        <>
          <Check size={16} />
          Copiado!
        </>
      ) : (
        <>
          <Copy size={16} />
          Copiar código PIX
        </>
      )}
    </button>
  )
}
