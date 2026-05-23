export interface PortalAlerta {
  tipo: 'atrasado' | 'vencendo' | 'em_dia' | 'mfa'
  mensagem: string
  loanId?: number
  installmentId?: number
}

export interface PortalUltimoPagamento {
  id: number
  valor: number
  dataPagamento: string
  metodoPagamento: string
  numeroParcela: number
  loanId: number
}

export interface PortalHome {
  contratosAtivos: number
  proximaParcela: {
    valor: number
    dataVencimento: string
    installmentId: number
  } | null
  totalEmAberto: number
  ultimosPagamentos: PortalUltimoPagamento[]
  alerta: PortalAlerta | null
}

export interface PortalContrato {
  id: number
  valor: number
  numeroParcelas: number
  dataInicio: string
  status: 'ativo' | 'quitado' | 'inadimplente' | 'cancelado' | string
  metodoPagamento: string
  percentualPago: number
  totalPago: number
  proximaParcela: {
    id: number
    valor: number
    dataVencimento: string
  } | null
}

export interface PortalParcela {
  id: number
  numero: number
  valor: number
  dataVencimento: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | string
  dataPagamento: string | null
}

export interface PortalContratoDetalhe {
  id: number
  valor: number
  numeroParcelas: number
  dataInicio: string
  status: string
  metodoPagamento: string
  totalParcelado: number
  totalPago: number
  saldoRestante: number
  parcelas: PortalParcela[]
}

export interface PortalPixData {
  pixId: number
  qrCode: string | null
  qrImage: string | null
  valor: number
  expiresAt: string | null
  status: string
}

export interface PortalPixStatus {
  status: string
  updatedAt: string
}

export interface PortalPagamento {
  id: number
  valor: number
  dataPagamento: string
  metodoPagamento: string
  numeroParcela: number
  loanId: number
}

export interface PortalTicket {
  id: number
  assunto: string
  mensagem: string
  status: 'aberto' | 'respondido' | 'fechado' | string
  resposta: string | null
  lido: boolean
  createdAt: string
  updatedAt: string
}

export interface PortalPerfil {
  id: number
  nome: string
  cpf: string
  email: string
  whatsapp: string
  telefone: string
  endereco: string
  bairro: string
  cidade: string
  estado: string
  mfaEnabled: boolean
  mfaLoginCount: number
  notificacoesEmail: boolean
  notificacoesWhatsapp: boolean
  senhaTemporaria: boolean
  primeiroAcesso: boolean
  score?: number
}
