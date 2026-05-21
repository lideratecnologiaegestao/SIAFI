import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
}

export function formatCPF(cpf: string) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

export function formatCEP(cep: string) {
  const d = cep.replace(/\D/g, '')
  if (d.length !== 8) return cep
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export const STATUS_LOAN: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  aguardando_aceite:    { label: 'Aguardando aceite', variant: 'warning' },
  aguardando_liberacao: { label: 'Aguardando liberação', variant: 'warning' },
  ativo:       { label: 'Ativo', variant: 'success' },
  quitado:     { label: 'Quitado', variant: 'outline' },
  cancelado:   { label: 'Cancelado', variant: 'destructive' },
  inadimplente: { label: 'Inadimplente', variant: 'warning' },
}

export const STATUS_INSTALLMENT: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  pendente:         { label: 'Pendente', variant: 'outline' },
  parcialmente_pago: { label: 'Parcialmente pago', variant: 'warning' },
  pago:             { label: 'Pago', variant: 'success' },
  atrasado:         { label: 'Atrasado', variant: 'destructive' },
  cancelado:        { label: 'Cancelado', variant: 'warning' },
}

export const METODO_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  mercadopago: 'Mercado Pago',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  cartao: 'Cartão',
}
