---
name: siafi-email-system
description: Use esta skill sempre que o projeto SIAFI precisar implementar ou modificar o sistema de emails. Cobre templates de email responsivos com cabeçalho, rodapé, logo e assinatura, todos os tipos de email do sistema (boas-vindas, ativação, redefinição de senha, notificação, cobrança, contrato, aviso), painel administrativo de gerenciamento de templates, envio via BullMQ/nodemailer e personalização por empresa. Acione esta skill quando o usuário mencionar: email, template de email, nodemailer, SMTP, boas-vindas, redefinição de senha, ativação de conta, boleto por email, notificação por email, painel de emails, editor de template, ou qualquer funcionalidade relacionada a comunicação por email no SIAFI.
---

## Stack e dependências obrigatórias

```
nodemailer          ^6.x   — envio SMTP
@types/nodemailer   ^6.x   — tipagem
handlebars          ^4.x   — motor de templates ({{variavel}})
mjml                ^4.x   — compilador HTML responsivo para email
sharp               ^0.x   — resize/otimização de logo antes de base64
```

Instalação:
```bash
npm install nodemailer handlebars mjml sharp
npm install -D @types/nodemailer
```

---

## Estrutura de arquivos gerada por esta skill

```
backend/src/modules/email/
├── email.module.ts              ← @Global() — disponível em todos os módulos
├── email.service.ts             ← envio, compilação de template, fallback
├── email.constants.ts           ← nomes dos tipos de email (enum-like)
├── email.interfaces.ts          ← interfaces TypeScript de todos os templates
├── templates/                   ← templates MJML source (fallback estático)
│   ├── _layout.mjml             ← layout base com header, footer, logo
│   ├── boas-vindas.mjml
│   ├── ativacao-conta.mjml
│   ├── redefinicao-senha.mjml
│   ├── notificacao.mjml
│   ├── cobranca-antecipada.mjml
│   ├── assinatura-contrato.mjml
│   ├── aviso.mjml
│   ├── proposta-aprovada.mjml
│   ├── proposta-rejeitada.mjml
│   ├── reparcelamento.mjml
│   └── capital-liberado.mjml
└── email.worker.ts              ← processor BullMQ para fila notif-queue

backend/prisma/schema.prisma
└── model EmailTemplate          ← templates editáveis no banco

frontend/src/app/(dashboard)/configuracoes/emails/
├── page.tsx                     ← lista de templates com preview
└── [tipo]/page.tsx              ← editor de template individual

frontend/src/components/email/
├── email-preview.tsx            ← iframe com preview do HTML compilado
└── email-variable-helper.tsx    ← lista de variáveis disponíveis por tipo
```

---

## Model EmailTemplate (Prisma)

```prisma
model EmailTemplate {
  id            Int      @id @default(autoincrement())
  tipo          String   @unique @db.VarChar(50)
  // Valor do EMAIL_TYPES — ex: 'boas_vindas', 'redefinicao_senha'

  // Configuração do remetente (pode sobrescrever o SMTP_FROM global)
  nomeRemetente String?  @db.VarChar(100) @map("nome_remetente")
  emailRemetente String? @db.VarChar(150) @map("email_remetente")

  // Conteúdo editável pelo admin
  assunto       String   @db.VarChar(255)
  // Suporta variáveis: "Olá {{clienteNome}}, seu contrato foi aprovado"

  corPrimaria   String   @default("#185FA5") @db.VarChar(7) @map("cor_primaria")
  corSecundaria String   @default("#0F6E56") @db.VarChar(7) @map("cor_secundaria")
  corTexto      String   @default("#1a1a18") @db.VarChar(7) @map("cor_texto")
  corFundo      String   @default("#f5f5f3") @db.VarChar(7) @map("cor_fundo")

  // Cabeçalho
  logoCabecalho String?  @db.Text @map("logo_cabecalho")
  // URL pública ou base64 do logo. Null = usar logo da SiteSetting
  corCabecalho  String   @default("#185FA5") @db.VarChar(7) @map("cor_cabecalho")
  textoCabecalho String? @db.VarChar(100) @map("texto_cabecalho")
  // Texto ao lado do logo (ex: "Lidera Financeira")

  // Corpo do email (HTML com variáveis Handlebars)
  corpo         String   @db.Text
  // O admin edita este campo no painel. Suporta {{variavel}}.

  // Rodapé
  rodapeTexto   String?  @db.Text @map("rodape_texto")
  // Ex: "Lidera Tecnologia e Gestão Ltda · CNPJ 00.000.000/0001-00"
  rodapeLinks   Json?    @map("rodape_links")
  // [{ label: "Portal", url: "https://..." }, { label: "Suporte", url: "..." }]

  // Assinatura
  assinaturaAtiva     Boolean @default(true)  @map("assinatura_ativa")
  assinaturaNome      String? @db.VarChar(100) @map("assinatura_nome")
  assinaturaCargo     String? @db.VarChar(100) @map("assinatura_cargo")
  assinaturaEmail     String? @db.VarChar(150) @map("assinatura_email")
  assinaturaWhatsapp  String? @db.VarChar(20)  @map("assinatura_whatsapp")
  assinaturaLogoUrl   String? @db.Text         @map("assinatura_logo_url")
  // Logo menor para a assinatura (diferente do cabeçalho)

  // Controle
  ativo         Boolean  @default(true)
  enviarCopia   String?  @db.VarChar(255) @map("enviar_copia")
  // Email(s) separados por vírgula para BCC obrigatório

  ultimoTeste   DateTime? @map("ultimo_teste")
  // Data do último envio de teste pelo admin

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("email_templates")
}
```

---

## EMAIL_TYPES — constantes obrigatórias

```typescript
// email.constants.ts
export const EMAIL_TYPES = {
  BOAS_VINDAS:          'boas_vindas',
  ATIVACAO_CONTA:       'ativacao_conta',
  REDEFINICAO_SENHA:    'redefinicao_senha',
  NOTIFICACAO_GERAL:    'notificacao_geral',
  COBRANCA_ANTECIPADA:  'cobranca_antecipada',
  ASSINATURA_CONTRATO:  'assinatura_contrato',
  AVISO:                'aviso',
  PROPOSTA_APROVADA:    'proposta_aprovada',
  PROPOSTA_REJEITADA:   'proposta_rejeitada',
  REPARCELAMENTO:       'reparcelamento',
  CAPITAL_LIBERADO:     'capital_liberado',
  PORTAL_ATIVADO:       'portal_ativado',
  PARCELA_VENCIDA:      'parcela_vencida',
} as const;

export type EmailType = typeof EMAIL_TYPES[keyof typeof EMAIL_TYPES];
```

---

## Variáveis disponíveis por tipo de email

```typescript
// email.interfaces.ts

// Variáveis globais — disponíveis em TODOS os templates
interface TemplateVarsGlobais {
  empresaNome:    string;   // SiteSetting: empresa.nome
  empresaCnpj:    string;   // SiteSetting: empresa.cnpj
  empresaTelefone: string;
  empresaEmail:   string;
  portalUrl:      string;   // https://financeiro.lidera.app.br/portal
  anoAtual:       string;   // new Date().getFullYear()
}

// Por tipo — acrescentam às globais
interface VarsBoasVindas extends TemplateVarsGlobais {
  clienteNome:    string;
  clienteEmail:   string;
  clienteCpf:     string;   // formatado: 000.000.000-00
  consultorNome:  string;
}

interface VarsAtivacaoConta extends TemplateVarsGlobais {
  clienteNome:    string;
  senhaTemporaria: string;
  loginUrl:       string;
  prazoSenhaHoras: string;  // ex: "48"
}

interface VarsRedefinicaoSenha extends TemplateVarsGlobais {
  nomeUsuario:    string;
  linkRedefinicao: string;
  prazoHoras:     string;   // ex: "2"
  ip:             string;   // IP de quem solicitou
  dataHora:       string;
}

interface VarsNotificacaoGeral extends TemplateVarsGlobais {
  destinatarioNome: string;
  titulo:         string;
  mensagem:       string;   // pode conter HTML básico
  ctaTexto?:      string;   // texto do botão (opcional)
  ctaUrl?:        string;   // link do botão (opcional)
}

interface VarsCobrancaAntecipada extends TemplateVarsGlobais {
  clienteNome:    string;
  numeroParcela:  string;
  totalParcelas:  string;
  valorParcela:   string;   // formatado: R$ 0.000,00
  dataVencimento: string;   // dd/MM/yyyy
  pixCopiaECola:  string;
  qrCodeBase64:   string;   // imagem do QR Code em base64
  diasAteVencer:  string;   // ex: "10"
  // Encargos por atraso (exibidos no rodapé do boleto)
  multaPercentual: string;  // ex: "2,00%"
  moraDiaria:     string;   // ex: "0,03% ao dia"
}

interface VarsAssinaturaContrato extends TemplateVarsGlobais {
  clienteNome:    string;
  numeroContrato: string;
  valorEmprestimo: string;
  numeroParcelas: string;
  valorParcela:   string;
  dataInicio:     string;
  diaVencimento:  string;
  totalAReceber:  string;
  linkContrato:   string;   // URL assinada do PDF no Supabase Storage
  dataAceite:     string;
  hashAceite:     string;   // primeiros 8 chars do SHA-256
}

interface VarsAviso extends TemplateVarsGlobais {
  destinatarioNome: string;
  tipoAviso:      string;   // 'urgente' | 'informativo' | 'atencao'
  titulo:         string;
  mensagem:       string;
  instrucoes?:    string;
}

interface VarsPropostaAprovada extends TemplateVarsGlobais {
  clienteNome:    string;
  valorAprovado:  string;
  numeroParcelas: string;
  valorParcela:   string;
  prazoAceite:    string;   // ex: "7 dias"
  linkPortal:     string;
}

interface VarsPropostaRejeitada extends TemplateVarsGlobais {
  clienteNome:    string;
  motivoRejeicao: string;
  consultorNome:  string;
  consultorWhatsapp: string;
}

interface VarsReparcelamento extends TemplateVarsGlobais {
  clienteNome:      string;
  contratoOriginal: string;
  novoValorParcela: string;
  novoNumeroParcelas: string;
  novaDataInicio:   string;
  multaAplicada:    string;
  moraAplicada:     string;
  linkAceite:       string;
  prazoAceite:      string;
}

interface VarsCapitalLiberado extends TemplateVarsGlobais {
  clienteNome:      string;
  valorLiberado:    string;
  metodoLiberacao:  string;  // 'PIX' | 'TED' | 'Dinheiro'
  dataLiberacao:    string;
  primeiraParcela:  string;
  dataVencimentoPrimeira: string;
  linkPortal:       string;
}
```

---

## EmailService — lógica de compilação e envio

```typescript
@Injectable()
export class EmailService {

  // Método principal — usado pelos workers e outros serviços
  async enviar(tipo: EmailType, destinatario: string, vars: Record<string, string>): Promise<void> {
    // 1. Buscar template do banco (com cache em memória por 5 min)
    const template = await this.obterTemplate(tipo);
    if (!template || !template.ativo) return;

    // 2. Injetar variáveis globais
    const varsCompletas = {
      ...await this.obterVarsGlobais(),
      ...vars,
    };

    // 3. Compilar assunto com Handlebars
    const assunto = Handlebars.compile(template.assunto)(varsCompletas);

    // 4. Compilar corpo com Handlebars
    const corpoCompilado = Handlebars.compile(template.corpo)(varsCompletas);

    // 5. Envolver no layout completo (cabeçalho + corpo + assinatura + rodapé)
    const htmlFinal = await this.compilarLayout(template, corpoCompilado, varsCompletas);

    // 6. Enviar via nodemailer
    const from = template.emailRemetente
      ? `${template.nomeRemetente} <${template.emailRemetente}>`
      : process.env.SMTP_FROM;

    const bcc = template.enviarCopia
      ? template.enviarCopia.split(',').map(e => e.trim())
      : undefined;

    await this.transporter.sendMail({
      from,
      to:      destinatario,
      subject: assunto,
      html:    htmlFinal,
      bcc,
    });

    // 7. Registrar na tabela notifications
    await this.prisma.notification.create({
      data: {
        tipo:     'email',
        assunto,
        mensagem: `Email ${tipo} enviado para ${destinatario}`,
        status:   'enviado',
        sentAt:   new Date(),
      }
    });
  }

  // Compilar o layout completo com todas as seções
  private async compilarLayout(
    template: EmailTemplate,
    corpo: string,
    vars: Record<string, string>
  ): Promise<string> {
    // Resolver logo: template > SiteSetting > fallback SVG inline
    const logoUrl = template.logoCabecalho
      ?? await this.settings.get('empresa.logoUrl')
      ?? null;

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${vars.empresaNome ?? 'SIAFI'}</title>
</head>
<body style="margin:0;padding:0;background-color:${template.corFundo};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${template.corFundo}">
  <tr><td align="center" style="padding:24px 16px">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">

    <!-- CABEÇALHO -->
    <tr>
      <td style="background:${template.corCabecalho};border-radius:8px 8px 0 0;padding:20px 28px;text-align:left">
        <table cellpadding="0" cellspacing="0">
          <tr>
            ${logoUrl ? `<td style="padding-right:12px"><img src="${logoUrl}" alt="${vars.empresaNome}" height="40" style="display:block;border:0"></td>` : ''}
            <td>
              <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;line-height:1.2">
                ${template.textoCabecalho ?? vars.empresaNome ?? 'Lidera Financeira'}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CORPO -->
    <tr>
      <td style="background:#ffffff;padding:32px 28px;color:${template.corTexto};font-size:15px;line-height:1.6">
        ${corpo}
      </td>
    </tr>

    <!-- ASSINATURA -->
    ${template.assinaturaAtiva && template.assinaturaNome ? `
    <tr>
      <td style="background:#ffffff;padding:0 28px 24px">
        <table cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e3;padding-top:16px;width:100%">
          <tr>
            ${template.assinaturaLogoUrl ? `
            <td style="padding-right:14px;vertical-align:top">
              <img src="${template.assinaturaLogoUrl}" alt="${template.assinaturaNome}" height="48" style="display:block;border:0;border-radius:4px">
            </td>` : ''}
            <td style="vertical-align:top">
              <p style="margin:0;font-size:14px;font-weight:600;color:${template.corTexto}">${template.assinaturaNome}</p>
              ${template.assinaturaCargo ? `<p style="margin:2px 0 0;font-size:12px;color:#73726c">${template.assinaturaCargo}</p>` : ''}
              ${template.assinaturaEmail ? `<p style="margin:4px 0 0;font-size:12px;color:${template.corPrimaria}">${template.assinaturaEmail}</p>` : ''}
              ${template.assinaturaWhatsapp ? `<p style="margin:2px 0 0;font-size:12px;color:#73726c">${template.assinaturaWhatsapp}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}

    <!-- RODAPÉ -->
    <tr>
      <td style="background:${template.corCabecalho}1a;border-top:1px solid ${template.corCabecalho}33;border-radius:0 0 8px 8px;padding:16px 28px;text-align:center">
        <p style="margin:0;font-size:12px;color:#73726c;line-height:1.6">
          ${template.rodapeTexto ?? `${vars.empresaNome} · ${vars.empresaEmail}`}
        </p>
        ${this.compilarLinksRodape(template.rodapeLinks as any[])}
        <p style="margin:8px 0 0;font-size:11px;color:#9e9c96">
          © ${vars.anoAtual} ${vars.empresaNome} · Todos os direitos reservados
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
  }

  private compilarLinksRodape(links?: { label: string; url: string }[]): string {
    if (!links?.length) return '';
    const itens = links.map(l =>
      `<a href="${l.url}" style="color:#185FA5;text-decoration:none;font-size:12px;margin:0 8px">${l.label}</a>`
    ).join(' · ');
    return `<p style="margin:6px 0 0">${itens}</p>`;
  }

  // Cache em memória — invalida após 5 minutos
  private templateCache = new Map<string, { data: EmailTemplate; at: number }>();

  private async obterTemplate(tipo: EmailType): Promise<EmailTemplate | null> {
    const cached = this.templateCache.get(tipo);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.data;

    const template = await this.prisma.emailTemplate.findUnique({ where: { tipo } });
    if (template) this.templateCache.set(tipo, { data: template, at: Date.now() });
    return template;
  }

  // Invalidar cache ao salvar no painel
  invalidarCache(tipo: EmailType) {
    this.templateCache.delete(tipo);
  }

  // Envio de teste pelo admin — retorna o HTML renderizado
  async enviarTeste(tipo: EmailType, destinatario: string): Promise<string> {
    const template = await this.obterTemplate(tipo);
    if (!template) throw new NotFoundException('Template não encontrado.');
    const varsDemo  = this.gerarVarsDemo(tipo);
    const corpo     = Handlebars.compile(template.corpo)(varsDemo);
    const html      = await this.compilarLayout(template, corpo, varsDemo);
    await this.transporter.sendMail({ from: process.env.SMTP_FROM, to: destinatario, subject: `[TESTE] ${template.assunto}`, html });
    await this.prisma.emailTemplate.update({ where: { tipo }, data: { ultimoTeste: new Date() } });
    return html;  // retornado para o preview no frontend
  }

  // Variáveis de demonstração para preview
  private gerarVarsDemo(tipo: EmailType): Record<string, string> {
    const base = {
      empresaNome: 'Lidera Financeira', empresaCnpj: '00.000.000/0001-00',
      empresaTelefone: '(65) 99999-9999', empresaEmail: 'contato@lidera.com.br',
      portalUrl: 'https://financeiro.lidera.app.br/portal', anoAtual: String(new Date().getFullYear()),
    };
    const demos: Record<string, Record<string, string>> = {
      boas_vindas:         { ...base, clienteNome: 'João da Silva', clienteEmail: 'joao@email.com', clienteCpf: '123.456.789-00', consultorNome: 'Maria Consultora' },
      ativacao_conta:      { ...base, clienteNome: 'João da Silva', senhaTemporaria: 'Xk#92mLp', loginUrl: 'https://financeiro.lidera.app.br/portal', prazoSenhaHoras: '48' },
      redefinicao_senha:   { ...base, nomeUsuario: 'João da Silva', linkRedefinicao: '#', prazoHoras: '2', ip: '189.123.45.67', dataHora: '21/05/2026 às 14:30' },
      notificacao_geral:   { ...base, destinatarioNome: 'João da Silva', titulo: 'Assunto da notificação', mensagem: 'Corpo da mensagem de notificação.', ctaTexto: 'Ver detalhes', ctaUrl: '#' },
      cobranca_antecipada: { ...base, clienteNome: 'João da Silva', numeroParcela: '3', totalParcelas: '10', valorParcela: 'R$ 280,00', dataVencimento: '10/06/2026', pixCopiaECola: '00020126580014br.gov.bcb...', qrCodeBase64: '', diasAteVencer: '10', multaPercentual: '2,00%', moraDiaria: '0,03% ao dia' },
      assinatura_contrato: { ...base, clienteNome: 'João da Silva', numeroContrato: '42', valorEmprestimo: 'R$ 2.000,00', numeroParcelas: '10', valorParcela: 'R$ 280,00', dataInicio: '01/06/2026', diaVencimento: '10', totalAReceber: 'R$ 2.800,00', linkContrato: '#', dataAceite: '21/05/2026 às 14:32', hashAceite: 'a1b2c3d4' },
      aviso:               { ...base, destinatarioNome: 'João da Silva', tipoAviso: 'urgente', titulo: 'Atenção: ação necessária', mensagem: 'Mensagem de aviso importante.', instrucoes: 'Acesse o portal e regularize sua situação.' },
      proposta_aprovada:   { ...base, clienteNome: 'João da Silva', valorAprovado: 'R$ 2.000,00', numeroParcelas: '10', valorParcela: 'R$ 280,00', prazoAceite: '7 dias', linkPortal: '#' },
      proposta_rejeitada:  { ...base, clienteNome: 'João da Silva', motivoRejeicao: 'Documentação incompleta.', consultorNome: 'Maria Consultora', consultorWhatsapp: '(65) 99999-9999' },
      reparcelamento:      { ...base, clienteNome: 'João da Silva', contratoOriginal: '42', novoValorParcela: 'R$ 320,00', novoNumeroParcelas: '12', novaDataInicio: '01/07/2026', multaAplicada: 'R$ 40,00', moraAplicada: 'R$ 12,60', linkAceite: '#', prazoAceite: '7 dias' },
      capital_liberado:    { ...base, clienteNome: 'João da Silva', valorLiberado: 'R$ 2.000,00', metodoLiberacao: 'PIX', dataLiberacao: '21/05/2026', primeiraParcela: 'R$ 280,00', dataVencimentoPrimeira: '21/06/2026', linkPortal: '#' },
      portal_ativado:      { ...base, clienteNome: 'João da Silva', senhaTemporaria: 'Xk#92mLp', loginUrl: '#', prazoSenhaHoras: '48' },
      parcela_vencida:     { ...base, clienteNome: 'João da Silva', numeroParcela: '3', totalParcelas: '10', valorOriginal: 'R$ 280,00', diasAtraso: '5', multaAplicada: 'R$ 5,60', moraAcumulada: 'R$ 0,93', totalComEncargos: 'R$ 286,53', linkPortal: '#' },
    };
    return demos[tipo] ?? base;
  }
}
```

---

## Seed dos templates padrão

Criar migration seed que insere todos os templates com corpo HTML padrão:

```typescript
// prisma/seeds/email-templates.seed.ts
const templates = [
  {
    tipo: 'boas_vindas',
    assunto: 'Bem-vindo à Lidera Financeira, {{clienteNome}}!',
    textoCabecalho: 'Lidera Financeira',
    corpo: `
<h2 style="margin:0 0 16px;color:{{corPrimaria}}">Olá, {{clienteNome}}! 👋</h2>
<p>Seja bem-vindo à <strong>{{empresaNome}}</strong>. Estamos felizes em ter você como nosso cliente.</p>
<p>Seu cadastro foi realizado com sucesso. Qualquer dúvida, entre em contato com seu consultor.</p>
<p style="margin-top:24px">Atenciosamente,<br><strong>Equipe {{empresaNome}}</strong></p>`,
    rodapeTexto: '{{empresaNome}} · {{empresaEmail}} · {{empresaTelefone}}',
    assinaturaAtiva: true,
    assinaturaNome: 'Equipe Lidera',
    assinaturaCargo: 'Atendimento ao Cliente',
  },
  {
    tipo: 'ativacao_conta',
    assunto: '{{clienteNome}}, seu acesso ao portal foi ativado',
    corpo: `
<h2 style="margin:0 0 16px;color:{{corPrimaria}}">Seu portal está pronto! 🎉</h2>
<p>Olá, <strong>{{clienteNome}}</strong>!</p>
<p>Seu acesso ao portal da <strong>{{empresaNome}}</strong> foi ativado.</p>
<table style="background:#f5f5f3;border-radius:8px;padding:16px;width:100%;margin:16px 0">
  <tr><td><strong>Login:</strong> {{clienteEmail}} ou {{clienteCpf}}</td></tr>
  <tr><td><strong>Senha temporária:</strong> <code>{{senhaTemporaria}}</code></td></tr>
</table>
<p>⚠️ Por segurança, você será solicitado a trocar a senha no primeiro acesso.</p>
<a href="{{loginUrl}}" style="display:inline-block;background:{{corPrimaria}};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;margin:16px 0">Acessar o portal →</a>
<p style="color:#73726c;font-size:13px">Este link expira em {{prazoSenhaHoras}} horas.</p>`,
  },
  {
    tipo: 'redefinicao_senha',
    assunto: 'Redefinição de senha — {{empresaNome}}',
    corpo: `
<h2 style="margin:0 0 16px;color:{{corPrimaria}}">Redefinição de senha</h2>
<p>Olá, <strong>{{nomeUsuario}}</strong>!</p>
<p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
<a href="{{linkRedefinicao}}" style="display:inline-block;background:{{corPrimaria}};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;margin:16px 0">Redefinir minha senha →</a>
<p style="color:#73726c;font-size:13px">⏱ Este link expira em <strong>{{prazoHoras}} horas</strong>.</p>
<p style="color:#73726c;font-size:13px">Solicitação feita em {{dataHora}} pelo IP {{ip}}.</p>
<p style="color:#73726c;font-size:13px">Se você não solicitou isto, ignore este email com segurança.</p>`,
  },
  // demais tipos seguem o mesmo padrão...
];
```

---

## Painel administrativo — rotas e endpoints

```
Backend:
GET    /api/email-templates              → listar todos (admin)
GET    /api/email-templates/:tipo        → detalhe de um template
PATCH  /api/email-templates/:tipo        → salvar edições (invalida cache)
POST   /api/email-templates/:tipo/teste  → enviar email de teste + retornar HTML
GET    /api/email-templates/:tipo/preview → retornar HTML compilado (vars demo)

Frontend:
/configuracoes/emails                   → lista com status e último teste
/configuracoes/emails/[tipo]            → editor completo do template
```

### Tela de lista `/configuracoes/emails`

```
┌────────────────────────────────────────────────────────────────┐
│  Templates de Email                                            │
├──────────────────┬──────────────────┬──────────┬──────────────┤
│ Tipo             │ Assunto           │ Ativo    │ Último teste │
├──────────────────┼──────────────────┼──────────┼──────────────┤
│ Boas-vindas      │ Bem-vindo, ...    │ ✅ Ativo │ 20/05/2026   │
│ Ativação conta   │ Seu portal está   │ ✅ Ativo │ 19/05/2026   │
│ Redefinição senha│ Redefinição de... │ ✅ Ativo │ —            │
│ Cobrança         │ Parcela próxima   │ ✅ Ativo │ 18/05/2026   │
│ ...              │ ...               │ ...      │ ...          │
├──────────────────┴──────────────────┴──────────┴──────────────┤
│  [ Enviar teste para: admin@lidera.com ] [ Testar todos ]     │
└────────────────────────────────────────────────────────────────┘
```

### Tela de editor `/configuracoes/emails/[tipo]`

Layout dividido em 2 colunas (editor | preview):

```
┌─────────────────────────────┬──────────────────────────────────┐
│  EDITOR                     │  PREVIEW AO VIVO                 │
│                             │                                  │
│  Assunto:                   │  ┌──────────────────────────┐    │
│  [ _____________________ ]  │  │  [LOGO]  Lidera          │    │
│                             │  ├──────────────────────────┤    │
│  Cores:                     │  │  Olá, João da Silva!     │    │
│  Primária [ #185FA5 ] ████  │  │  ...corpo compilado...   │    │
│  Fundo    [ #f5f5f3 ] ████  │  │  [Botão CTA]             │    │
│  Texto    [ #1a1a18 ] ████  │  ├──────────────────────────┤    │
│                             │  │  Assinatura              │    │
│  Cabeçalho:                 │  ├──────────────────────────┤    │
│  Cor   [ #185FA5 ]          │  │  Rodapé                  │    │
│  Texto [ ___________ ]      │  └──────────────────────────┘    │
│  Logo  [ Upload ] [URL]     │                                  │
│                             │  Variáveis disponíveis:          │
│  Corpo (HTML + Handlebars): │  {{clienteNome}} {{valorParcela}}│
│  ┌─────────────────────┐    │  {{dataVencimento}} ...          │
│  │                     │    │                                  │
│  │  editor textarea    │    │  [ Enviar teste para mim ]       │
│  │                     │    │                                  │
│  └─────────────────────┘    └──────────────────────────────────┘
│                             
│  Assinatura:
│  ☑ Exibir assinatura
│  Nome:   [ _____________ ]
│  Cargo:  [ _____________ ]
│  Email:  [ _____________ ]
│  WA:     [ _____________ ]
│
│  Rodapé:
│  Texto: [ ________________ ]
│  Links: [ +Adicionar link ]
│
│  BCC:   [ admin@lidera.com ]
│
│  [ Cancelar ]  [ Salvar template ]
```

---

## Worker BullMQ para email

```typescript
// Job names suportados pelo email.worker.ts:
'email.boas-vindas'
'email.ativacao-conta'
'email.redefinicao-senha'
'email.notificacao-geral'
'email.cobranca-antecipada'    ← PDF em base64 no payload
'email.assinatura-contrato'    ← PDF em base64 no payload
'email.aviso'
'email.proposta-aprovada'
'email.proposta-rejeitada'
'email.reparcelamento'
'email.capital-liberado'
'email.portal-ativado'
'email.parcela-vencida'

// Interface do job payload:
interface EmailJobPayload {
  tipo:         EmailType;
  destinatario: string;
  vars:         Record<string, string>;
  pdfBase64?:   string;    // presente apenas em cobrança e contrato
  pdfNome?:     string;
}

// No worker:
@Process('email.*')  // captura todos os tipos
async handleEmail(job: Job<EmailJobPayload>) {
  await this.emailService.enviar(
    job.data.tipo,
    job.data.destinatario,
    job.data.vars,
    job.data.pdfBase64,
    job.data.pdfNome
  );
}
```

---

## Regras críticas desta skill

- Template do banco SEMPRE tem prioridade sobre o arquivo MJML estático
- Cache de 5 minutos em memória — invalidar ao salvar via painel
- Se template não encontrado no banco: usar arquivo MJML estático como fallback
- Se arquivo MJML também não existir: logar erro e não lançar exception (email silencioso)
- Variáveis não resolvidas pelo Handlebars: substituir por string vazia (não exibir `{{var}}`)
  Configurar: `Handlebars.compile(template, { knownHelpersOnly: false })`
- QR Code em base64: nunca enviar URL externa em emails (bloqueado por clientes de email)
- PDF como attachment: limite de 5MB por email — comprimir com sharp se necessário
- BCC: registrar no AuditLog toda vez que BCC for usado
- Preview: renderizar com vars demo — nunca dados reais de clientes no painel
- Cores: validar formato HEX (#RRGGBB) antes de salvar — rejeitar inválidos
- Logo upload: aceitar apenas PNG/JPG/SVG — converter para base64 inline no HTML
  (clientes de email bloqueiam imagens externas por padrão)
- Testar em: Gmail, Outlook, Apple Mail — layouts com table (não flexbox/grid)
- diaVencimento e campos numéricos: sempre formatar com locale pt-BR antes de injetar

## Checklist pós-implementação

- [ ] Todos os 13 tipos de email têm template seed no banco
- [ ] EmailService injetável em qualquer módulo via @Global()
- [ ] Cache invalidado ao salvar no painel administrativo
- [ ] Fallback para MJML estático quando template não existe no banco
- [ ] Preview ao vivo funcionando com vars demo (sem dados reais)
- [ ] Envio de teste funcionando e retornando HTML para o iframe
- [ ] PDF anexado em cobrança e assinatura de contrato
- [ ] Logo em base64 inline (não URL externa)
- [ ] BCC registrado no AuditLog
- [ ] Variáveis documentadas na tela do editor
- [ ] Worker BullMQ capturando todos os tipos com 'email.*'
