'use client'

import Link from 'next/link'
import { ArrowLeft, Plus, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { usePortalTickets } from '@/hooks/portal/use-portal-suporte'

const STATUS_TICKET: Record<string, { label: string; variant: 'outline' | 'secondary' | 'success' | 'destructive' }> = {
  aberto: { label: 'Aguardando', variant: 'outline' },
  respondido: { label: 'Respondido', variant: 'secondary' },
  fechado: { label: 'Resolvido', variant: 'success' },
  resolvido: { label: 'Resolvido', variant: 'success' },
}

export default function SuportePage() {
  const { data, isLoading } = usePortalTickets()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal">
          <button className="text-muted-foreground hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </button>
        </Link>
        <h1 className="text-xl font-bold">Suporte</h1>
        <Link href="/portal/suporte/novo" className="ml-auto">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />Novo chamado
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <MessageSquare className="size-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhum chamado aberto.</p>
            <Link href="/portal/suporte/novo">
              <Button size="sm">Abrir meu primeiro chamado</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map(t => {
            const st = STATUS_TICKET[t.status] ?? { label: t.status, variant: 'outline' as const }
            const naoLido = t.status === 'respondido' && !t.lido
            return (
              <Link key={t.id} href={`/portal/suporte/${t.id}`}>
                <Card className={`hover:bg-muted/20 transition-colors cursor-pointer ${naoLido ? 'border-blue-300 bg-blue-50/30' : ''}`}>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {naoLido && (
                            <span className="size-2 rounded-full bg-blue-600 shrink-0" aria-label="Não lido" />
                          )}
                          <p className="font-medium text-sm truncate">{t.assunto}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          #{t.id} · Aberto em {formatDate(t.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {naoLido && (
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Novo</span>
                        )}
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
