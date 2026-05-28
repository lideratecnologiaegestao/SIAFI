'use client'

import { CheckCircle, Clock, AlertTriangle, XCircle, PenLine, Ban } from 'lucide-react'

/* ─── Loan Status ──────────────────────────────────────────────── */

type LoanStatusKey =
  | 'aguardando_aceite'
  | 'aguardando_liberacao'
  | 'ativo'
  | 'quitado'
  | 'cancelado'
  | 'inadimplente'

interface LoanBadgeCfg {
  label: string
  bg: string
  text: string
  icon?: React.ReactNode
  dot?: boolean
}

const LOAN_CFG: Record<string, LoanBadgeCfg> = {
  aguardando_aceite: {
    label: 'Aguardando assinatura',
    bg: 'var(--portal-amber-100)',
    text: 'var(--portal-amber-600)',
    icon: <PenLine size={11} />,
  },
  aguardando_liberacao: {
    label: 'Aguardando liberação',
    bg: 'var(--portal-blue-100)',
    text: 'var(--portal-blue-600)',
    icon: <Clock size={11} />,
  },
  ativo: {
    label: 'Ativo',
    bg: 'var(--portal-green-100)',
    text: 'var(--portal-green-600)',
    dot: true,
  },
  quitado: {
    label: 'Quitado',
    bg: 'var(--portal-gray-100)',
    text: 'var(--portal-gray-600)',
    icon: <CheckCircle size={11} />,
  },
  cancelado: {
    label: 'Cancelado',
    bg: 'var(--portal-gray-100)',
    text: 'var(--portal-gray-600)',
    icon: <Ban size={11} />,
  },
  inadimplente: {
    label: 'Inadimplente',
    bg: 'var(--portal-red-100)',
    text: 'var(--portal-red-600)',
    icon: <AlertTriangle size={11} />,
  },
}

export function LoanStatusBadge({ status }: { status: string }) {
  const cfg: LoanBadgeCfg = LOAN_CFG[status] ?? {
    label: status,
    bg: 'var(--portal-gray-100)',
    text: 'var(--portal-gray-600)',
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        background: cfg.bg,
        color: cfg.text,
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: 'var(--font-dm-sans, sans-serif)',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.dot && (
        <span
          className="status-dot-active"
          style={{
            display: 'inline-block',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: cfg.text,
            flexShrink: 0,
          }}
        />
      )}
      {!cfg.dot && cfg.icon}
      {cfg.label}
    </span>
  )
}

/* ─── Installment Status ───────────────────────────────────────── */

type InstallmentStatusKey =
  | 'pendente'
  | 'parcialmente_pago'
  | 'pago'
  | 'atrasado'
  | 'cancelado'

interface InstallmentBadgeCfg {
  label: string
  bg: string
  text: string
  icon: React.ReactNode
}

const INST_CFG: Record<string, InstallmentBadgeCfg> = {
  pago: {
    label: 'Pago',
    bg: 'var(--portal-green-100)',
    text: 'var(--portal-green-600)',
    icon: <CheckCircle size={11} />,
  },
  pendente: {
    label: 'Pendente',
    bg: 'var(--portal-gray-100)',
    text: 'var(--portal-gray-600)',
    icon: <Clock size={11} />,
  },
  parcialmente_pago: {
    label: 'Parcial',
    bg: 'var(--portal-amber-100)',
    text: 'var(--portal-amber-600)',
    icon: <Clock size={11} />,
  },
  atrasado: {
    label: 'Atrasado',
    bg: 'var(--portal-red-100)',
    text: 'var(--portal-red-600)',
    icon: <AlertTriangle size={11} />,
  },
  cancelado: {
    label: 'Cancelado',
    bg: 'var(--portal-gray-100)',
    text: 'var(--portal-gray-600)',
    icon: <XCircle size={11} />,
  },
}

export function InstallmentStatusBadge({ status }: { status: string }) {
  const cfg: InstallmentBadgeCfg = INST_CFG[status] ?? {
    label: status,
    bg: 'var(--portal-gray-100)',
    text: 'var(--portal-gray-600)',
    icon: <Clock size={11} />,
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        background: cfg.bg,
        color: cfg.text,
        fontSize: '11px',
        fontWeight: 500,
        fontFamily: 'var(--font-dm-sans, sans-serif)',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}
