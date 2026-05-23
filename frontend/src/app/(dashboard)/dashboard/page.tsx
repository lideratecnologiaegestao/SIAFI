'use client'

import { useAuth } from '@/contexts/auth.context'
import { Loader2 } from 'lucide-react'
import DashboardFinanceiro from './dashboard-financeiro'
import DashboardConsultor from './dashboard-consultor'
import DashboardCaixa from './dashboard-caixa'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (user.role === 'consultor') return <DashboardConsultor />
  if (user.role === 'caixa')    return <DashboardCaixa />
  return <DashboardFinanceiro />
}
