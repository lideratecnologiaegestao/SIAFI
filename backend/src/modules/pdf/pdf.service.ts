import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

function fmt(v: number | string | null | undefined): string {
  return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

@Injectable()
export class PdfService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Contrato de Empréstimo ───────────────────────────────────────────────

  async gerarContratoEmprestimo(loanId: number, res: Response): Promise<void> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        client: {
          select: {
            nome: true, cpf: true, rg: true, endereco: true,
            bairro: true, cidade: true, estado: true, cep: true,
            whatsapp: true, email: true,
          },
        },
        installments: {
          orderBy: { numero: 'asc' },
          select: { numero: true, installmentAmount: true, dataVencimento: true, status: true },
        },
      },
    });

    if (!loan) throw new NotFoundException('Contrato não encontrado.');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contrato-${loanId}.pdf"`,
    );
    doc.pipe(res);

    const primary = '#1e40af';
    const pageW = doc.page.width - 100; // usable width (50 margin each side)

    // ── Cabeçalho ──
    doc.fontSize(18).fillColor(primary).font('Helvetica-Bold')
       .text('CONTRATO DE EMPRÉSTIMO PESSOAL', 50, 50, { width: pageW, align: 'center' });
    doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
       .text('Lidera Tecnologia e Gestão — Sistema SIAFI', { align: 'center' });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.5);

    // ── Partes ──
    this.section(doc, primary, 'PARTES');

    this.field(doc, 'CREDOR', 'Lidera Tecnologia e Gestão Ltda.');
    this.field(doc, 'DEVEDOR', loan.client.nome);
    this.field(doc, 'CPF', loan.client.cpf ?? '—');
    this.field(doc, 'RG', loan.client.rg ?? '—');

    const endereco = [
      loan.client.endereco,
      loan.client.bairro,
      loan.client.cidade,
      loan.client.estado,
      loan.client.cep,
    ].filter(Boolean).join(', ');
    this.field(doc, 'ENDEREÇO', endereco || '—');

    doc.moveDown(0.5);

    // ── Condições do Empréstimo ──
    this.section(doc, primary, 'CONDIÇÕES DO EMPRÉSTIMO');

    this.field(doc, 'Nº do Contrato', `#${loan.id}`);
    this.field(doc, 'Data de Início', fmtDate(loan.dataInicio));
    const valorParcela = loan.installments[0]?.installmentAmount ?? 0;
    const totalPagar = loan.installments.reduce((s, i) => s + Number(i.installmentAmount), 0);
    this.field(doc, 'Capital Desembolsado', fmt(Number(loan.principalAmount)));
    this.field(doc, 'Nº de Parcelas', String(loan.numeroParcelas));
    this.field(doc, 'Valor da Parcela', fmt(Number(valorParcela)));
    this.field(doc, 'Total a Pagar', fmt(totalPagar));
    if (loan.taxaJuros != null) this.field(doc, 'Taxa de Juros', `${Number(loan.taxaJuros).toFixed(2)}% a.m.`);
    this.field(doc, 'Multa por Atraso', `${Number(loan.taxaMulta).toFixed(1)}%`);
    this.field(doc, 'Mora Mensal', `${Number(loan.taxaMora).toFixed(1)}% ao mês`);
    if (loan.metodoPagamento) {
      this.field(doc, 'Método de Pagamento', loan.metodoPagamento);
    }
    if (loan.observacoes) {
      this.field(doc, 'Observações', loan.observacoes);
    }

    doc.moveDown(0.5);

    // ── Tabela de Parcelas ──
    this.section(doc, primary, 'PLANO DE PAGAMENTO');

    // Cabeçalho da tabela
    const colX = [50, 110, 230, 360];
    doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
    doc.rect(50, doc.y, pageW, 18).fill(primary);
    const rowY = doc.y - 14;
    doc.fillColor('#ffffff')
       .text('Nº', colX[0], rowY, { width: 55 })
       .text('Vencimento', colX[1], rowY, { width: 115 })
       .text('Valor', colX[2], rowY, { width: 115 })
       .text('Status', colX[3], rowY, { width: 120 });

    doc.moveDown(0.4);

    const statusLabel: Record<string, string> = {
      pendente: 'Pendente', pago: 'Pago', atrasado: 'Em atraso', cancelado: 'Cancelado',
    };
    const statusColor: Record<string, string> = {
      pendente: '#374151', pago: '#166534', atrasado: '#991b1b', cancelado: '#6b7280',
    };

    loan.installments.forEach((inst, idx) => {
      if (doc.y > 720) { doc.addPage(); }
      const y = doc.y;
      const bg = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(50, y - 2, pageW, 16).fill(bg);

      doc.fontSize(9).font('Helvetica').fillColor(statusColor[inst.status] ?? '#374151');
      doc.text(String(inst.numero), colX[0], y, { width: 55 })
         .text(fmtDate(inst.dataVencimento), colX[1], y, { width: 115 })
         .text(fmt(Number(inst.installmentAmount)), colX[2], y, { width: 115 })
         .text(statusLabel[inst.status] ?? inst.status, colX[3], y, { width: 120 });
      doc.moveDown(0.3);
    });

    doc.moveDown(1);

    // ── Cláusulas ──
    this.section(doc, primary, 'CLÁUSULAS');

    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    const clausulas = [
      `1. O DEVEDOR se compromete a pagar as parcelas nas datas de vencimento indicadas.`,
      `2. O atraso no pagamento de qualquer parcela sujeita o DEVEDOR ao pagamento de multa de ${Number(loan.taxaMulta).toFixed(1)}% sobre o saldo devedor, acrescido de mora de ${Number(loan.taxaMora).toFixed(1)}% ao mês, proporcional aos dias de atraso.`,
      `3. O CREDOR poderá exigir antecipação do vencimento das demais parcelas em caso de inadimplência superior a 30 dias.`,
      `4. Este contrato é celebrado em conformidade com o Código Civil Brasileiro e demais legislações aplicáveis.`,
      `5. As partes elegem o foro da comarca da cidade do CREDOR para dirimir quaisquer controvérsias.`,
    ];

    clausulas.forEach((c) => {
      if (doc.y > 720) doc.addPage();
      doc.text(c, { width: pageW, align: 'justify' }).moveDown(0.4);
    });

    doc.moveDown(1);

    // ── Assinaturas ──
    if (doc.y > 660) doc.addPage();

    this.section(doc, primary, 'ASSINATURAS');
    doc.moveDown(0.5);

    const sigY = doc.y + 30;
    doc.moveTo(50, sigY).lineTo(240, sigY).strokeColor('#374151').stroke();
    doc.moveTo(310, sigY).lineTo(500, sigY).stroke();

    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    doc.text('CREDOR: Lidera Tecnologia e Gestão', 50, sigY + 5, { width: 190 });
    doc.text(`DEVEDOR: ${loan.client.nome}`, 310, sigY + 5, { width: 190 });

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#9ca3af')
       .text(`Documento gerado em ${fmtDate(new Date())} pelo Sistema SIAFI.`, {
         align: 'center', width: pageW,
       });

    doc.end();
  }

  // ─── Recibo de Pagamento ──────────────────────────────────────────────────

  async gerarReciboPagamento(paymentId: number, res: Response): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        installment: {
          include: {
            loan: {
              include: {
                client: { select: { nome: true, cpf: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) throw new NotFoundException('Pagamento não encontrado.');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="recibo-${paymentId}.pdf"`,
    );
    doc.pipe(res);

    const primary = '#1e40af';
    const pageW = doc.page.width - 100;
    const inst = payment.installment;
    const loan = inst.loan;

    doc.fontSize(18).fillColor(primary).font('Helvetica-Bold')
       .text('RECIBO DE PAGAMENTO', 50, 50, { width: pageW, align: 'center' });
    doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
       .text('Lidera Tecnologia e Gestão — Sistema SIAFI', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.5);

    this.section(doc, primary, 'DADOS DO PAGAMENTO');

    this.field(doc, 'Recibo Nº', String(payment.id));
    this.field(doc, 'Data do Pagamento', fmtDate(payment.dataPagamento));
    this.field(doc, 'Devedor', loan.client.nome);
    this.field(doc, 'CPF', loan.client.cpf ?? '—');
    this.field(doc, 'Contrato Nº', String(loan.id));
    this.field(doc, 'Parcela', `${inst.numero} de ${loan.numeroParcelas}`);
    this.field(doc, 'Vencimento', fmtDate(inst.dataVencimento));
    this.field(doc, 'Valor da Parcela', fmt(Number(inst.installmentAmount)));
    this.field(doc, 'Valor Pago', fmt(Number(payment.valorPago)));
    this.field(doc, 'Método', payment.metodoPagamento);
    if (payment.observacao) this.field(doc, 'Observação', payment.observacao);

    doc.moveDown(1.5);

    // Declaração
    doc.fontSize(11).fillColor('#374151').font('Helvetica')
       .text(
         `Recebi de ${loan.client.nome} (CPF: ${loan.client.cpf ?? '—'}) a quantia de ` +
         `${fmt(Number(payment.valorPago))}, referente ao pagamento da parcela ` +
         `${inst.numero}/${loan.numeroParcelas} do contrato nº ${loan.id}, ` +
         `vencida em ${fmtDate(inst.dataVencimento)}.`,
         { width: pageW, align: 'justify' },
       );

    doc.moveDown(2);

    if (doc.y > 660) doc.addPage();
    const sigY = doc.y + 30;
    doc.moveTo(150, sigY).lineTo(410, sigY).strokeColor('#374151').stroke();
    doc.fontSize(9).fillColor('#374151').font('Helvetica')
       .text('Lidera Tecnologia e Gestão — Credor', 150, sigY + 5, { width: 260, align: 'center' });

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#9ca3af')
       .text(`Documento gerado em ${fmtDate(new Date())} pelo Sistema SIAFI.`, {
         align: 'center', width: pageW,
       });

    doc.end();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private section(doc: PDFKit.PDFDocument, color: string, title: string) {
    doc.fontSize(11).fillColor(color).font('Helvetica-Bold').text(title).moveDown(0.3);
  }

  private field(doc: PDFKit.PDFDocument, label: string, value: string) {
    const pageW = doc.page.width - 100;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151')
       .text(`${label}: `, { continued: true, width: pageW });
    doc.font('Helvetica').text(value).moveDown(0.2);
  }
}
