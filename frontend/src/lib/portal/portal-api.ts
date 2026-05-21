import api from '@/lib/api'
import type {
  PortalHome,
  PortalContrato,
  PortalContratoDetalhe,
  PortalPixData,
  PortalPixStatus,
  PortalPagamento,
  PortalTicket,
  PortalPerfil,
} from './portal-types'

export const portalApi = {
  getHome: () => api.get<PortalHome>('/portal/home').then(r => r.data),

  getContratos: () => api.get<PortalContrato[]>('/portal/contratos').then(r => r.data),

  getContrato: (id: number) =>
    api.get<PortalContratoDetalhe>(`/portal/contratos/${id}`).then(r => r.data),

  gerarPix: (installmentId: number) =>
    api.post<PortalPixData>('/portal/pix/gerar', { installmentId }).then(r => r.data),

  getPixStatus: (pixId: number) =>
    api.get<PortalPixStatus>(`/portal/pix/status/${pixId}`).then(r => r.data),

  getPagamentos: (loanId?: number) =>
    api.get<PortalPagamento[]>('/portal/pagamentos', { params: loanId ? { loanId } : undefined }).then(r => r.data),

  getTickets: () => api.get<PortalTicket[]>('/portal/suporte').then(r => r.data),

  getTicket: (id: number) => api.get<PortalTicket>(`/portal/suporte/${id}`).then(r => r.data),

  createTicket: (assunto: string, mensagem: string) =>
    api.post<PortalTicket>('/portal/suporte', { assunto, mensagem }).then(r => r.data),

  marcarTicketLido: (id: number) =>
    api.patch(`/portal/suporte/${id}/lido`).then(r => r.data),

  getPerfil: () => api.get<PortalPerfil>('/portal/perfil').then(r => r.data),

  marcarPrimeiroAcesso: () =>
    api.patch('/portal/perfil/primeiro-acesso').then(r => r.data),

  updateMfa: (mfaEnabled: boolean) =>
    api.patch('/portal/perfil/mfa', { mfaEnabled }).then(r => r.data),

  updateNotificacoes: (body: { notificacoesEmail?: boolean; notificacoesWhatsapp?: boolean }) =>
    api.patch('/portal/notificacoes', body).then(r => r.data),
}
