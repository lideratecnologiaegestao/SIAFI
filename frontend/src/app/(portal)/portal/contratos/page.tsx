'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { FileText, ChevronRight, QrCode } from 'lucide-react'
import { portalClient } from '@/lib/portal/portal-client'
import { MoneyDisplay } from '@/components/portal/money-display'
import { LoanStatusBadge } from '@/components/portal/status-badges'
import { ProgressBar } from '@/components/portal/progress-bar'
import { SkeletonContractCard } from '@/components/portal/skeleton-card'

interface Contrato {
  id: number
  valor: number
  numeroParcelas: number
  dataInicio: string
  status: string
  metodoPagamento: string
  percentualPago: number
  totalPago: number
  totalParcelado?: number
  proximaParcela: { id: number; valor: number; dataVencimento: string } | null
}

type Filtro = 'todos' | 'ativos' | 'quitados' | 'outros'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',    label: 'Todos'     },
  { key: 'ativos',   label: 'Ativos'    },
  { key: 'quitados', label: 'Quitados'  },
  { key: 'outros',   label: 'Outros'    },
]

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR')
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function getProgressColor(status: string, proximaData?: string): 'green' | 'amber' | 'red' {
  if (status === 'inadimplente') return 'red'
  if (!proximaData) return 'green'
  const dias = Math.floor((new Date(proximaData).getTime() - Date.now()) / 86_400_000)
  if (dias < 0) return 'red'
  if (dias <= 5) return 'amber'
  return 'green'
}

function filtraNaCorreta(c: Contrato, filtro: Filtro): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'ativos') return c.status === 'ativo' || c.status === 'inadimplente' || c.status === 'aguardando_aceite' || c.status === 'aguardando_liberacao'
  if (filtro === 'quitados') return c.status === 'quitado'
  return c.status === 'cancelado'
}

export default function ContratosPage() {
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const { data, isLoading } = useQuery<Contrato[]>({
    queryKey: ['portal-contratos'],
    queryFn: () => portalClient.get('/portal/contratos').then(r => r.data),
    staleTime: 60_000,
  })

  const filtrados = data?.filter(c => filtraNaCorreta(c, filtro)) ?? []

  return (
    <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Título */}
      <h1 style={{
        fontSize: '22px',
        fontWeight: 700,
        color: 'var(--portal-gray-950)',
        fontFamily: 'var(--font-dm-sans, sans-serif)',
      }}>
        Meus Contratos
      </h1>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: `1px solid ${filtro === f.key ? 'var(--portal-blue-600)' : 'var(--portal-gray-300)'}`,
              background: filtro === f.key ? 'var(--portal-blue-600)' : 'var(--portal-white)',
              color: filtro === f.key ? '#fff' : 'var(--portal-gray-600)',
              fontSize: '13px',
              fontWeight: filtro === f.key ? 600 : 400,
              fontFamily: 'var(--font-dm-sans, sans-serif)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => <SkeletonContractCard key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtrados.length === 0 && (
        <div style={{
          background: 'var(--portal-white)',
          borderRadius: 'var(--portal-radius-card)',
          padding: '48px 24px',
          boxShadow: 'var(--portal-shadow-card)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <FileText size={40} color="var(--portal-gray-300)" />
          <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Nenhum contrato encontrado
          </p>
          <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            {filtro === 'todos'
              ? 'Fale com seu consultor para iniciar um contrato.'
              : 'Tente outro filtro acima.'}
          </p>
        </div>
      )}

      {/* Lista */}
      {!isLoading && filtrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtrados.map((c, idx) => {
            const progColor = getProgressColor(c.status, c.proximaParcela?.dataVencimento)
            const pctPago = c.percentualPago
            const parcelasPagas = Math.round((pctPago / 100) * c.numeroParcelas)

            return (
              <div
                key={c.id}
                className="pcard"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  padding: '20px',
                  borderLeft: c.status === 'inadimplente' ? '4px solid var(--portal-red-600)' : 'none',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                      Início: {fmtDate(c.dataInicio)}
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginTop: '1px' }}>
                      Contrato {idx + 1}
                    </p>
                  </div>
                  <LoanStatusBadge status={c.status} />
                </div>

                {/* Valores */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <MoneyDisplay value={c.valor} size="sm" label="Valor emprestado" />
                  {c.totalParcelado && (
                    <MoneyDisplay value={c.totalParcelado} size="sm" label="Total a pagar" />
                  )}
                </div>

                {/* Progresso */}
                {c.status !== 'cancelado' && (
                  <ProgressBar
                    value={pctPago}
                    color={progColor}
                    animated
                    label={`${parcelasPagas} de ${c.numeroParcelas} parcelas pagas`}
                  />
                )}

                {/* Próxima parcela */}
                {c.proximaParcela && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--portal-gray-100)',
                  }}>
                    <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                      Vence em {fmtDate(c.proximaParcela.dataVencimento)}
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                      {fmtCurrency(c.proximaParcela.valor)}
                    </p>
                  </div>
                )}

                {/* Botões */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link href={`/portal/contratos/${c.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                    <button style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--portal-gray-300)',
                      background: 'var(--portal-white)',
                      color: 'var(--portal-gray-800)',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: 'var(--font-dm-sans, sans-serif)',
                      cursor: 'pointer',
                    }}>
                      <ChevronRight size={14} />
                      Ver detalhes
                    </button>
                  </Link>

                  {c.proximaParcela && (c.status === 'ativo' || c.status === 'inadimplente') && (
                    <Link href={`/portal/pagamentos/pix/${c.proximaParcela.id}`} style={{ textDecoration: 'none' }}>
                      <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--portal-blue-600)',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-dm-sans, sans-serif)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}>
                        <QrCode size={14} />
                        Pagar PIX
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
