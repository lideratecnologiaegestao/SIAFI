'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConsultorRootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/consultor/carteira') }, [router])
  return null
}
