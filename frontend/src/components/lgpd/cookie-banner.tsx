'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'

const STORAGE_KEY = 'siafi_cookie_consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {}
  }, [])

  function handleAccept() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ aceito: true, timestamp: new Date().toISOString(), versao: '1.0' }),
      )
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso sobre cookies"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white dark:bg-zinc-900 shadow-lg"
    >
      <div className="max-w-4xl mx-auto flex items-start gap-4 p-4">
        <Cookie className="size-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Utilizamos apenas cookies <strong>essenciais</strong> para manter você autenticado com segurança.
            Não utilizamos cookies de rastreamento ou publicidade.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAccept}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Entendi
            </button>
            <Link
              href="/politica-de-cookies"
              target="_blank"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Política de Cookies
            </Link>
          </div>
        </div>
        <button
          onClick={handleAccept}
          aria-label="Fechar aviso de cookies"
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
