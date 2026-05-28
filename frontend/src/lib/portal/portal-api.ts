import { portalClient } from '@/lib/portal/portal-client'
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
  getHome: () => portalClient.get<PortalHome>('/portal/home').then(r => r.data),

  getContratos: () => portalClient.get<PortalContrato[]>('/portal/contratos').then(r => r.data),

  getContrato: (id: number) =>
    portalClient.get<PortalContratoDetalhe>(`/portal/contratos/${id}`).then(r => r.data),

  gerarPix: (installmentId: number) =>
    portalClient.post<PortalPixData>('/portal/pix/gerar', { installmentId }).then(r => r.data),

  getPixStatus: (pixId: number) =>
    portalClient.get<PortalPixStatus>(`/portal/pix/status/${pixId}`).then(r => r.data),

  getPagamentos: (loanId?: number) =>
    portalClient.get<PortalPagamento[]>('/portal/pagamentos', { params: loanId ? { loanId } : undefined }).then(r => r.data),

  getTickets: () => portalClient.get<PortalTicket[]>('/portal/suporte').then(r => r.data),

  getTicket: (id: number) => portalClient.get<PortalTicket>(`/portal/suporte/${id}`).then(r => r.data),

  createTicket: (assunto: string, mensagem: string) =>
    portalClient.post<PortalTicket>('/portal/suporte', { assunto, mensagem }).then(r => r.data),

  marcarTicketLido: (id: number) =>
    portalClient.patch(`/portal/suporte/${id}/lido`).then(r => r.data),

  getPerfil: () => portalClient.get<PortalPerfil>('/portal/perfil').then(r => r.data),

  marcarPrimeiroAcesso: () =>
    portalClient.patch('/portal/perfil/primeiro-acesso').then(r => r.data),

  updateMfa: (mfaEnabled: boolean) =>
    portalClient.patch('/portal/perfil/mfa', { mfaEnabled }).then(r => r.data),

  updateNotificacoes: (body: { notificacoesEmail?: boolean; notificacoesWhatsapp?: boolean }) =>
    portalClient.patch('/portal/notificacoes', body).then(r => r.data),

  // LGPD
  registrarConsentimento: (body: { tipo: string; versao: string; aceito: boolean }) =>
    portalClient.post('/portal/lgpd/consentimento', body).then(r => r.data),

  listarConsentimentos: () =>
    portalClient.get('/portal/lgpd/consentimentos').then(r => r.data),

  criarSolicitacaoTitular: (body: { tipo: string; descricao: string }) =>
    portalClient.post('/portal/lgpd/solicitacao', body).then(r => r.data),

  listarSolicitacoesTitular: () =>
    portalClient.get('/portal/lgpd/solicitacoes').then(r => r.data),

  getMeusDados: () =>
    portalClient.get('/portal/lgpd/meus-dados').then(r => r.data),
}
