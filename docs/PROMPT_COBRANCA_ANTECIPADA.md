# SIAFI 2.0 — Cobrança Antecipada Configurável por Contrato
# Boleto/PIX com envio automático, multa e mora individuais por loan
# Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md
e os resultados das Fases anteriores já implementadas.

---

```
Você é um Engenheiro de Software Sênior. Implemente as seguintes
melhorias no módulo de empréstimos do SIAFI. Leia toda a documentação
antes de começar. Entregue um grupo por vez e aguarde confirmação.

═══════════════════════════════════════════════════════════════════
CONTEXTO — O QUE PRECISA SER FEITO
═══════════════════════════════════════════════════════════════════

Cada contrato de empréstimo precisa ter:

1. CONFIGURAÇÃO INDIVIDUAL DE ENCARGOS: multa e mora próprias por
   contrato, independentes dos valores globais de site_settings.

2. ENVIO ANTECIPADO DE COBRANÇA: X dias antes do vencimento de cada
   parcela (configurável por contrato), o sistema envia automaticamente
   o boleto com código de barras ou QR Code PIX via:
   - WhatsApp (Evolution API)
   - E-mail (SMTP com PDF anexado)
   - Portal do cliente (disponível para download)

3. DATAS DE VENCIMENTO FIXAS POR CONTRATO: ao criar o empréstimo,
   o operador define o dia do mês para vencimento (ex: sempre dia 10).
   As parcelas são geradas respeitando esse dia fixo.

═══════════════════════════════════════════════════════════════════
PARTE 1 — SCHEMA PRISMA: CAMPOS INDIVIDUAIS NO LOAN
═══════════════════════════════════════════════════════════════════

## 1.1 — Novos campos em model Loan

Adicione ao model Loan os seguintes campos de configuração individual.
Quando não informados, o sistema usa os valores de site_settings como
fallback — mas o contrato sempre tem precedência.

```prisma
model Loan {
  // ... todos os campos existentes + campos dos prompts anteriores ...

  // ── Encargos individuais por contrato ──────────────────────────
  multaPercentual     Decimal?  @db.Decimal(5,4) @map("multa_percentual")
  // Ex: 0.0200 = 2%. Null = usar site_settings financeiro.multa_atraso_percentual

  moraDiariaPercentual Decimal? @db.Decimal(7,6) @map("mora_diaria_percentual")
  // Ex: 0.000333 = 0,0333%/dia (equivale a ~1%/mês). Null = usar site_settings

  // ── Configuração de cobrança antecipada ────────────────────────
  diasAntecedenciaCobranca Int   @default(10) @map("dias_antecedencia_cobranca")
  // Quantos dias antes do vencimento enviar boleto/PIX ao cliente
  // Padrão: 10 dias. Configurável por contrato entre 1 e 30 dias.

  diaVencimento       Int?      @map("dia_vencimento")
  // Dia fixo do mês para vencimento de todas as parcelas (1-28)
  // Ex: 10 = toda parcela vence no dia 10 do mês correspondente
  // Null = usar dataInicio + N meses (comportamento atual)

  // ── Canais de cobrança habilitados por contrato ─────────────────
  cobrarWhatsapp      Boolean   @default(true)  @map("cobrar_whatsapp")
  cobrarEmail         Boolean   @default(true)  @map("cobrar_email")
  cobrarPortal        Boolean   @default(true)  @map("cobrar_portal")
}
```

## 1.2 — Novos campos em model Installment

```prisma
model Installment {
  // ... campos existentes + saldoDevedor + moraAcumulada dos prompts anteriores ...

  // ── Cobrança antecipada ────────────────────────────────────────
  cobrancaEnviadaEm   DateTime? @map("cobranca_enviada_em")
  // Timestamp do último envio de cobrança antecipada desta parcela

  cobrancaWhatsappOk  Boolean   @default(false) @map("cobranca_whatsapp_ok")
  cobrancaEmailOk     Boolean   @default(false) @map("cobranca_email_ok")
  cobrancaPortalOk    Boolean   @default(false) @map("cobranca_portal_ok")
  // Flags individuais de entrega por canal

  // ── Encargos calculados e aplicados ───────────────────────────
  multaAplicada       Decimal   @default(0) @db.Decimal(10,2) @map("multa_aplicada")
  // Multa calculada no momento em que a parcela virou "atrasado"

  valorComEncargos    Decimal?  @db.Decimal(10,2) @map("valor_com_encargos")
  // installmentAmount + multaAplicada + moraAcumulada
  // Calculado e atualizado diariamente pelo cron para facilitar exibição

  pixCobrancaId       Int?      @map("pix_cobranca_id")
  // FK para PixPayment gerado especificamente para cobrança antecipada
}
```

## 1.3 — Seed de novas configurações globais (site_settings)

```typescript
// Valores globais — usados como fallback quando o contrato não define individualmente
'financeiro.multa_atraso_percentual'   → '2.00'   // 2%
'financeiro.mora_dia_percentual'       → '0.0333'  // ~1%/mês
'financeiro.dias_antecedencia_cobranca' → '10'     // 10 dias antes
'financeiro.cobranca_whatsapp_ativo'   → 'true'
'financeiro.cobranca_email_ativo'      → 'true'
```

═══════════════════════════════════════════════════════════════════
PARTE 2 — GERAÇÃO DE PARCELAS COM DIA FIXO
═══════════════════════════════════════════════════════════════════

## 2.1 — Lógica de dataVencimento com dia fixo

No `LoansService.createLoan()`, ao gerar as installments:

```typescript
import { setDate, addMonths, getDaysInMonth } from 'date-fns';

function calcularDataVencimento(
  dataInicio: Date,
  numeroParcela: number,
  diaVencimento?: number | null
): Date {
  // Base: mês de referência desta parcela
  const mesBase = addMonths(dataInicio, numeroParcela);

  if (!diaVencimento) {
    // Comportamento anterior: dataInicio + N meses
    return mesBase;
  }

  // Dia fixo: usar o dia configurado, respeitando meses curtos
  // Ex: dia 31 em fevereiro → dia 28 (último dia do mês)
  const diasNoMes = getDaysInMonth(mesBase);
  const diaReal   = Math.min(diaVencimento, diasNoMes);
  return setDate(mesBase, diaReal);
}

// Ao gerar o array de installments:
installments.push({
  numero:           i + 1,
  installmentAmount: ...,
  principalPayback:  ...,
  netGain:           ...,
  dataVencimento:   calcularDataVencimento(dataInicio, i + 1, loan.diaVencimento),
  status:           'pendente',
  totalPago:        0,
  saldoDevedor:     installmentAmount,  // começa igual ao valor total
})
```

## 2.2 — DTO atualizado

```typescript
export class CreateLoanDto {
  // ... campos existentes ...

  @IsInt() @Min(1) @Max(28) @IsOptional()
  diaVencimento?: number;
  // Se informado: todas as parcelas vencem neste dia do mês
  // Se não informado: dataInicio + N meses (comportamento atual)

  @IsDecimal() @IsOptional()
  multaPercentual?: string;
  // Ex: '2.00' = 2%. Deixar vazio para usar global

  @IsDecimal() @IsOptional()
  moraDiariaPercentual?: string;
  // Ex: '0.0333'. Deixar vazio para usar global

  @IsInt() @Min(1) @Max(30) @IsOptional()
  diasAntecedenciaCobranca?: number;
  // Padrão: 10. Quantos dias antes do vencimento enviar a cobrança

  @IsBoolean() @IsOptional()
  cobrarWhatsapp?: boolean;

  @IsBoolean() @IsOptional()
  cobrarEmail?: boolean;
}
```

═══════════════════════════════════════════════════════════════════
PARTE 3 — SERVIÇO DE COBRANÇA ANTECIPADA
═══════════════════════════════════════════════════════════════════

## 3.1 — CobrancaService (novo serviço)

Criar `src/modules/cobranca/cobranca.service.ts`:

```typescript
@Injectable()
export class CobrancaService {

  // Método principal — chamado pelo cron
  async processarCobrancasAntecipadas(): Promise<void> {
    const agora    = new Date();

    // Buscar todas as parcelas que precisam de cobrança hoje
    // Lógica: dataVencimento - diasAntecedenciaCobranca <= hoje
    //         E ainda não foram enviadas (cobrancaEnviadaEm === null)
    //         E status = pendente (não cobrar parcelas já atrasadas aqui)

    const parcelas = await this.prisma.installment.findMany({
      where: {
        status: 'pendente',
        cobrancaEnviadaEm: null,
        loan: { status: 'ativo' },
      },
      include: {
        loan: {
          include: {
            client: true,
          }
        }
      }
    });

    // Filtrar as que entram no prazo hoje
    const paraEnviar = parcelas.filter(p => {
      const diasAnt = p.loan.diasAntecedenciaCobranca;
      const dataEnvio = subDays(p.dataVencimento, diasAnt);
      return isSameDay(dataEnvio, agora) || isBefore(dataEnvio, agora);
    });

    for (const parcela of paraEnviar) {
      await this.enviarCobranca(parcela);
    }
  }

  async enviarCobranca(parcela: InstallmentComLoan): Promise<void> {
    const { loan } = parcela;
    const cliente  = loan.client;

    // 1. Gerar ou reutilizar QR Code PIX para esta parcela
    const pixData = await this.pixService.gerarOuReutilizar(
      parcela.id,
      cliente.id,
      parcela.installmentAmount
    );

    // 2. Gerar PDF do boleto/cobrança
    const pdfBuffer = await this.gerarPdfCobranca(parcela, pixData, loan);

    // 3. Enviar pelos canais habilitados no contrato
    const resultados = await Promise.allSettled([
      loan.cobrarWhatsapp && cliente.whatsapp
        ? this.enviarWhatsapp(parcela, pixData, loan, cliente)
        : Promise.resolve(false),
      loan.cobrarEmail && cliente.email
        ? this.enviarEmail(parcela, pdfBuffer, pixData, loan, cliente)
        : Promise.resolve(false),
      loan.cobrarPortal
        ? this.salvarNoPortal(parcela, pdfBuffer, pixData)
        : Promise.resolve(false),
    ]);

    // 4. Atualizar flags de entrega na parcela
    await this.prisma.installment.update({
      where: { id: parcela.id },
      data: {
        cobrancaEnviadaEm:  new Date(),
        cobrancaWhatsappOk: resultados[0].status === 'fulfilled' && resultados[0].value !== false,
        cobrancaEmailOk:    resultados[1].status === 'fulfilled' && resultados[1].value !== false,
        cobrancaPortalOk:   resultados[2].status === 'fulfilled' && resultados[2].value !== false,
        pixCobrancaId:      pixData.id,
      }
    });

    // 5. Log de notificação
    await this.prisma.notification.create({
      data: {
        clientId:  cliente.id,
        loanId:    loan.id,
        tipo:      'cobranca_antecipada',
        assunto:   `Parcela ${parcela.numero}/${loan.numeroParcelas} — vence ${format(parcela.dataVencimento, 'dd/MM/yyyy')}`,
        mensagem:  `Cobrança enviada ${loan.diasAntecedenciaCobranca} dias antes do vencimento.`,
        status:    'enviado',
        sentAt:    new Date(),
      }
    });

    // 6. AuditLog
    await this.prisma.auditLog.create({
      data: {
        acao:       'COBRANCA_ANTECIPADA_ENVIADA',
        entidade:   'installments',
        entidadeId: parcela.id,
        dados: {
          canais: {
            whatsapp: resultados[0].status === 'fulfilled',
            email:    resultados[1].status === 'fulfilled',
            portal:   resultados[2].status === 'fulfilled',
          },
          diasAntecedencia: loan.diasAntecedenciaCobranca,
          valorCobrado:     parcela.installmentAmount,
        }
      }
    });
  }

  // ── WhatsApp ──────────────────────────────────────────────────
  private async enviarWhatsapp(
    parcela: Installment,
    pixData: PixPayment,
    loan: Loan,
    cliente: Client
  ): Promise<boolean> {
    const mensagem = this.templateWhatsapp(parcela, pixData, loan, cliente);
    await this.notifQueue.add('whatsapp.cobranca-antecipada', {
      clientId:        cliente.id,
      clienteNome:     cliente.nome,
      clienteWhatsapp: cliente.whatsapp,
      mensagem,
      pixCopiaECola:   pixData.qrCode,
    });
    return true;
  }

  private templateWhatsapp(p: Installment, pix: PixPayment, l: Loan, c: Client): string {
    return [
      `Olá, ${c.nome}! 👋`,
      ``,
      `Lembramos que sua parcela está próxima do vencimento:`,
      ``,
      `📋 *Parcela ${p.numero}/${l.numeroParcelas}*`,
      `💰 Valor: *R$ ${formatDecimal(p.installmentAmount)}*`,
      `📅 Vencimento: *${format(p.dataVencimento, 'dd/MM/yyyy')}*`,
      ``,
      `Para pagar via PIX, use o código abaixo:`,
      ``,
      pix.qrCode,
      ``,
      `Ou acesse o portal para baixar o boleto:`,
      `https://financeiro.lidera.app.br/portal`,
      ``,
      `Em caso de dúvidas, entre em contato com seu consultor.`,
    ].join('\n');
  }

  // ── E-mail ────────────────────────────────────────────────────
  private async enviarEmail(
    parcela: Installment,
    pdfBuffer: Buffer,
    pixData: PixPayment,
    loan: Loan,
    cliente: Client
  ): Promise<boolean> {
    await this.notifQueue.add('email.cobranca-antecipada', {
      clientId:    cliente.id,
      clienteNome: cliente.nome,
      clienteEmail: cliente.email,
      assunto:     `Lembrete de vencimento — Parcela ${parcela.numero}/${loan.numeroParcelas}`,
      // PDF em base64 para o worker de email anexar
      pdfBase64:   pdfBuffer.toString('base64'),
      pdfNome:     `boleto_parcela_${parcela.numero}_${format(parcela.dataVencimento, 'yyyy-MM-dd')}.pdf`,
      templateData: {
        nome:          cliente.nome,
        numeroParcela: parcela.numero,
        totalParcelas: loan.numeroParcelas,
        valor:         formatDecimal(parcela.installmentAmount),
        vencimento:    format(parcela.dataVencimento, 'dd/MM/yyyy'),
        pixCopiaECola: pixData.qrCode,
        portalUrl:     'https://financeiro.lidera.app.br/portal',
      }
    });
    return true;
  }

  // ── Portal ────────────────────────────────────────────────────
  private async salvarNoPortal(
    parcela: Installment,
    pdfBuffer: Buffer,
    pixData: PixPayment
  ): Promise<boolean> {
    // Salvar PDF no Supabase Storage: bucket 'boletos-cobranca' (privado)
    // Path: {clientId}/parcela_{loanId}_{numero}_{dataVencimento}.pdf
    const path = `${parcela.loan.clientId}/parcela_${parcela.loanId}_${parcela.numero}_${format(parcela.dataVencimento, 'yyyy-MM-dd')}.pdf`;
    await this.supabase.uploadFile('boletos-cobranca', path, pdfBuffer, 'application/pdf');
    return true;
  }
}
```

## 3.2 — Geração do PDF de cobrança

```typescript
private async gerarPdfCobranca(
  parcela: Installment,
  pixData: PixPayment,
  loan: Loan
): Promise<Buffer> {
  // Usar puppeteer ou @react-pdf/renderer (conforme implementado no projeto)
  // O PDF deve conter:
  // - Cabeçalho com logo da Lidera e dados da empresa
  // - Dados do cliente (nome, CPF formatado)
  // - Dados do contrato (número, data de início)
  // - Dados da parcela (número, valor, vencimento)
  // - QR Code PIX (imagem pixData.qrImage em base64)
  // - Código copia e cola (pixData.qrCode)
  // - Tabela de encargos por atraso:
  //   "Após o vencimento: multa de X% + mora de Y% ao dia"
  // - Rodapé: "Em caso de dúvidas, contate seu consultor"
}
```

═══════════════════════════════════════════════════════════════════
PARTE 4 — CRON JOBS ATUALIZADOS
═══════════════════════════════════════════════════════════════════

## 4.1 — Cron: envio de cobranças antecipadas — 09h

```typescript
@Cron('0 9 * * *')
async enviarCobrancasAntecipadas() {
  // Chama CobrancaService.processarCobrancasAntecipadas()
  // Este job substitui o sendReminders genérico para parcelas pendentes
  // A lógica de "dias antes" é respeitada individualmente por contrato
}
```

## 4.2 — Cron: atualizar valorComEncargos — 08h (junto com markOverdue)

Após marcar parcelas como atrasadas, recalcular `valorComEncargos`:

```typescript
async atualizarEncargos() {
  const atrasadas = await this.prisma.installment.findMany({
    where: { status: { in: ['atrasado', 'parcialmente_pago'] } },
    include: { loan: true }
  });

  for (const inst of atrasadas) {
    // Obter percentuais: usar contrato se definido, senão site_settings
    const multaPerc = inst.loan.multaPercentual
      ? new Decimal(inst.loan.multaPercentual.toString())
      : new Decimal(await this.settings.get('financeiro.multa_atraso_percentual'));

    const moraPerc = inst.loan.moraDiariaPercentual
      ? new Decimal(inst.loan.moraDiariaPercentual.toString())
      : new Decimal(await this.settings.get('financeiro.mora_dia_percentual'));

    const saldo       = new Decimal(inst.saldoDevedor.toString());
    const diasAtraso  = differenceInDays(new Date(), inst.dataVencimento);

    // Multa: aplicada uma vez (somente no D+1, não acumula)
    const multa = inst.multaAplicada.toString() === '0'
      ? saldo.times(multaPerc.dividedBy(100))
      : new Decimal(inst.multaAplicada.toString());

    // Mora: diária sobre saldo devedor
    const mora = saldo.times(moraPerc.dividedBy(100)).times(Math.max(0, diasAtraso));

    const valorTotal = saldo.plus(multa).plus(mora);

    await this.prisma.installment.update({
      where: { id: inst.id },
      data: {
        multaAplicada:    multa.toDecimalPlaces(2).toNumber(),
        moraAcumulada:    mora.toDecimalPlaces(2).toNumber(),
        valorComEncargos: valorTotal.toDecimalPlaces(2).toNumber(),
      }
    });
  }
}
```

## 4.3 — Cron: reenvio de cobrança se não houve confirmação de leitura

```typescript
// Rodar às 09h — 3 dias antes do vencimento (se ainda não pago)
@Cron('0 9 * * *')
async reenviarCobrancaNaoLida() {
  const em3dias = addDays(new Date(), 3);
  const parcelas = await this.prisma.installment.findMany({
    where: {
      status: 'pendente',
      cobrancaEnviadaEm: { not: null },
      // Cobrar novamente se: enviou mas o cliente não pagou e vence em <= 3 dias
      dataVencimento: { lte: em3dias },
      totalPago: 0,
    },
    include: { loan: { include: { client: true } } }
  });

  for (const p of parcelas) {
    // Só reenviar se passaram pelo menos 3 dias desde o envio anterior
    const diasDesdeEnvio = differenceInDays(new Date(), p.cobrancaEnviadaEm!);
    if (diasDesdeEnvio >= 3) {
      await this.cobrancaService.enviarCobranca(p);
    }
  }
}
```

═══════════════════════════════════════════════════════════════════
PARTE 5 — WORKERS BULLMQ ATUALIZADOS
═══════════════════════════════════════════════════════════════════

## 5.1 — WhatsApp Worker: novo job type

Adicionar ao `whatsapp.worker.ts`:

```typescript
@Process('whatsapp.cobranca-antecipada')
async handleCobrancaAntecipada(job: Job<{
  clienteNome: string;
  clienteWhatsapp: string;
  mensagem: string;
  pixCopiaECola: string;
}>) {
  const { clienteWhatsapp, mensagem } = job.data;
  // Enviar via Evolution API
  await this.evolutionApi.sendText(clienteWhatsapp, mensagem);
  // Aguardar 2s e enviar o código copia e cola separado (para o cliente copiar fácil)
  await sleep(2000);
  await this.evolutionApi.sendText(clienteWhatsapp, job.data.pixCopiaECola);
}
```

## 5.2 — Email Worker: job com PDF anexado

Adicionar ao `email.worker.ts`:

```typescript
@Process('email.cobranca-antecipada')
async handleCobrancaEmail(job: Job<{
  clienteEmail: string;
  assunto: string;
  pdfBase64: string;
  pdfNome: string;
  templateData: Record<string, string>;
}>) {
  const { clienteEmail, assunto, pdfBase64, pdfNome, templateData } = job.data;
  const html = this.renderTemplateEmail(templateData);

  await this.transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      clienteEmail,
    subject: assunto,
    html,
    attachments: [{
      filename: pdfNome,
      content:  Buffer.from(pdfBase64, 'base64'),
      contentType: 'application/pdf',
    }]
  });
}

private renderTemplateEmail(data: Record<string, string>): string {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a18">
    <div style="border-bottom:2px solid #185FA5;padding-bottom:16px;margin-bottom:24px">
      <h2 style="color:#185FA5;margin:0">Lidera Financeira</h2>
    </div>
    <p>Olá, <strong>${data.nome}</strong>!</p>
    <p>Sua parcela está próxima do vencimento:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f5f5f3">
        <td style="padding:10px;border:0.5px solid #d3d1c7">Parcela</td>
        <td style="padding:10px;border:0.5px solid #d3d1c7"><strong>${data.numeroParcela} de ${data.totalParcelas}</strong></td>
      </tr>
      <tr>
        <td style="padding:10px;border:0.5px solid #d3d1c7">Valor</td>
        <td style="padding:10px;border:0.5px solid #d3d1c7"><strong>R$ ${data.valor}</strong></td>
      </tr>
      <tr style="background:#f5f5f3">
        <td style="padding:10px;border:0.5px solid #d3d1c7">Vencimento</td>
        <td style="padding:10px;border:0.5px solid #d3d1c7"><strong>${data.vencimento}</strong></td>
      </tr>
    </table>
    <p style="color:#5F5E5A;font-size:13px">O boleto está anexo a este e-mail.</p>
    <p style="color:#5F5E5A;font-size:13px">Você também pode pagar via PIX usando o código abaixo:</p>
    <code style="display:block;background:#f5f5f3;padding:12px;border-radius:6px;font-size:11px;word-break:break-all;margin:8px 0">${data.pixCopiaECola}</code>
    <a href="${data.portalUrl}" style="display:inline-block;background:#185FA5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:12px">Acessar portal</a>
    <p style="margin-top:24px;color:#888;font-size:12px">Lidera Tecnologia e Gestão Ltda · Em caso de dúvidas, contate seu consultor.</p>
  </div>`;
}
```

═══════════════════════════════════════════════════════════════════
PARTE 6 — PORTAL DO CLIENTE: DOWNLOAD DO BOLETO
═══════════════════════════════════════════════════════════════════

## 6.1 — Endpoint de download

```
GET /api/portal/parcelas/:id/boleto
→ Retorna URL assinada (1h) para o PDF no Supabase Storage
→ ClientPortalGuard + validação de ownership obrigatória
→ Se boleto não foi gerado ainda: gera on-demand e salva
```

## 6.2 — Tela da parcela no portal

Na tabela de parcelas, adicionar botão de download:

```
Nº | Vencimento | Valor    | Status          | Ações
───┼────────────┼──────────┼─────────────────┼───────────────────────
3  | 10/06/26   | R$280,00 | 🔵 Pendente     | [Pagar PIX] [↓ Boleto]
4  | 10/07/26   | R$280,00 | ⏳ Aguardando   | [↓ Boleto disponível em 30/06]
```

Regras de exibição:
- Botão "↓ Boleto": disponível quando `cobrancaPortalOk = true`
- Se ainda não disponível: mostrar data prevista de disponibilidade
  (`dataVencimento - diasAntecedenciaCobranca`)
- Download abre URL assinada em nova aba (não forçar download)

## 6.3 — Notificação Realtime no portal

Quando o boleto for gerado e salvo no portal, disparar evento via
Supabase Realtime para atualizar o badge de notificações do cliente:

```typescript
// A publication supabase_realtime já inclui a tabela installments
// Frontend escuta UPDATE em installments onde cobrancaPortalOk muda para true
// Ao receber: mostrar toast "Seu boleto está disponível para download!"
```

═══════════════════════════════════════════════════════════════════
PARTE 7 — FRONTEND OPERACIONAL: CONFIGURAÇÃO NO FORMULÁRIO
═══════════════════════════════════════════════════════════════════

## 7.1 — Seção "Configurações de cobrança" no formulário de novo empréstimo

Adicionar seção expansível abaixo dos campos principais:

```
┌──────────────────────────────────────────────────────────────┐
│  Configurações de cobrança e encargos     [▼ Expandir]       │
├──────────────────────────────────────────────────────────────┤
│  Dia fixo de vencimento (opcional)                           │
│  [ __ ] Deixe em branco para usar dataInício + N meses       │
│  Ex: 10 = toda parcela vence no dia 10                       │
│                                                              │
│  Enviar cobrança antecipada                                  │
│  [ 10 ] dias antes do vencimento                             │
│                                                              │
│  Canais de cobrança                                          │
│  [✓] WhatsApp   [✓] E-mail   [✓] Portal                     │
│                                                              │
│  Encargos por atraso (deixe em branco para usar o padrão)    │
│  Multa:  [ _____ ] %   Padrão: 2,00%                        │
│  Mora:   [ _____ ] % ao dia   Padrão: 0,0333%/dia           │
│                                                              │
│  Preview de encargos:                                        │
│  Parcela de R$ 280,00 atrasada 30 dias:                      │
│  Multa: R$ 5,60 · Mora: R$ 2,80 · Total: R$ 288,40          │
└──────────────────────────────────────────────────────────────┘
```

Preview de encargos calculado ao vivo com decimal.js:
```typescript
const valorParcela = new Decimal(watch('installmentAmount') || '0');
const multaPerc    = new Decimal(watch('multaPercentual') || globalSettings.multa);
const moraPerc     = new Decimal(watch('moraDiariaPercentual') || globalSettings.mora);
const diasExemplo  = 30;

const multa  = valorParcela.times(multaPerc.dividedBy(100));
const mora   = valorParcela.times(moraPerc.dividedBy(100)).times(diasExemplo);
const total  = valorParcela.plus(multa).plus(mora);
```

## 7.2 — Detalhe do contrato: painel de cobranças

Na tela `/emprestimos/[id]`, adicionar aba "Cobranças" ao lado de "Parcelas":

```
┌──────────────────────────────────────────────────────────────┐
│  Histórico de cobranças enviadas                             │
├───┬────────────┬──────────────┬─────┬──────┬────────────────┤
│ # │ Vencimento │ Enviada em   │ WA  │ Mail │ Portal         │
├───┼────────────┼──────────────┼─────┼──────┼────────────────┤
│ 1 │ 10/04/26   │ 31/03/26     │ ✅  │  ✅  │ ✅ Baixado     │
│ 2 │ 10/05/26   │ 30/04/26     │ ✅  │  ✅  │ ✅ Não baixado │
│ 3 │ 10/06/26   │ Agendada     │  -  │   -  │ -              │
└───┴────────────┴──────────────┴─────┴──────┴────────────────┘
```

═══════════════════════════════════════════════════════════════════
ENTREGÁVEIS — ORDEM DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════

GRUPO A — Schema e migration
  1. Campos novos em Loan: multaPercentual, moraDiariaPercentual,
     diasAntecedenciaCobranca, diaVencimento, cobrarWhatsapp,
     cobrarEmail, cobrarPortal
  2. Campos novos em Installment: cobrancaEnviadaEm,
     cobrancaWhatsappOk, cobrancaEmailOk, cobrancaPortalOk,
     multaAplicada, valorComEncargos, pixCobrancaId
  3. Seed das novas chaves em site_settings
  4. Criar bucket 'boletos-cobranca' no Supabase Storage (privado)

GRUPO B — Lógica de geração de parcelas
  5. calcularDataVencimento() com dia fixo (respeitando meses curtos)
  6. CreateLoanDto com novos campos
  7. LoansService.createLoan(): usar diaVencimento ao gerar parcelas
     e inicializar saldoDevedor = installmentAmount

GRUPO C — Serviço de cobrança
  8. CobrancaModule + CobrancaService
  9. enviarCobranca() com Promise.allSettled em 3 canais
  10. gerarPdfCobranca() com QR Code + encargos no rodapé
  11. salvarNoPortal() via Supabase Storage

GRUPO D — Workers e crons
  12. whatsapp.worker: job 'whatsapp.cobranca-antecipada'
  13. email.worker: job 'email.cobranca-antecipada' com PDF anexado
  14. CronService: enviarCobrancasAntecipadas (09h)
  15. CronService: atualizarEncargos (08h, junto com markOverdue)
  16. CronService: reenviarCobrancaNaoLida (09h, D-3 sem pagamento)

GRUPO E — Portal do cliente
  17. GET /api/portal/parcelas/:id/boleto (download URL assinada)
  18. Botão "↓ Boleto" na tabela de parcelas
  19. Data prevista de disponibilidade se ainda não gerado
  20. Toast Realtime quando boleto ficar disponível

GRUPO F — Frontend operacional
  21. Seção "Configurações de cobrança" no formulário de novo empréstimo
  22. Preview ao vivo de encargos por atraso
  23. Aba "Cobranças" no detalhe do contrato com histórico

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════════
- decimal.js em TODO cálculo de multa, mora, valorComEncargos e preview
- Fallback obrigatório: loan.multaPercentual ?? site_settings (nunca null sem default)
- diaVencimento limitado a 1-28 (nunca 29, 30, 31 para evitar problemas em fev)
- PDF gerado ANTES de enfileirar os jobs de WhatsApp e email
- Promise.allSettled (não Promise.all) para não falhar tudo se um canal falhar
- Falha em um canal: registrar no AuditLog mas continuar com os demais
- cobrancaEnviadaEm atualizado mesmo se algum canal falhar
- URL assinada do boleto: expirar em 1h (padrão Supabase Storage)
- Bucket 'boletos-cobranca': privado, apenas PDF, 5MB max
- Reenvio: mínimo 3 dias de intervalo entre envios (evitar spam)
- Multa aplicada uma vez (D+1) — não acumular multa diariamente
- Mora: diária, sobre saldoDevedor, acumula dia a dia
- AuditLog em todo envio de cobrança (COBRANCA_ANTECIPADA_ENVIADA)
```
