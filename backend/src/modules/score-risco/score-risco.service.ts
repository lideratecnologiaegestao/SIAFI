import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScoreRiscoService {
  private readonly logger = new Logger(ScoreRiscoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recalcularScore(clientId: number): Promise<void> {
    try {
      const [loans, parcelas] = await Promise.all([
        this.prisma.loan.findMany({
          where: { clientId },
          select: { status: true, reparcelamentoCount: true },
        }),
        this.prisma.installment.findMany({
          where: { loan: { clientId } },
          select: { status: true },
        }),
      ]);

      const totalEmprestimos      = loans.length;
      const totalQuitados         = loans.filter(l => l.status === 'quitado').length;
      const totalReparcelamentos  = loans.reduce((acc, l) => acc + l.reparcelamentoCount, 0);
      const totalPagas            = parcelas.filter(p => p.status === 'pago').length;
      const totalAtrasadas        = parcelas.filter(p => p.status === 'atrasado').length;

      // Fórmulas conforme spec (escala 0-100)
      const scorePontualidade = totalPagas > 0
        ? Math.max(0, Math.round(100 - (totalAtrasadas / (totalPagas + totalAtrasadas)) * 100))
        : 100;

      const scoreReparcelamentos = Math.max(0, 100 - totalReparcelamentos * 15);

      const scoreQuitacoes = totalEmprestimos > 0
        ? Math.round((totalQuitados / totalEmprestimos) * 100)
        : 50;

      const scoreGeral = Math.round(
        scorePontualidade * 0.5 +
        scoreReparcelamentos * 0.3 +
        scoreQuitacoes * 0.2,
      );

      const classificacao =
        scoreGeral >= 85 ? 'excelente' :
        scoreGeral >= 70 ? 'bom' :
        scoreGeral >= 50 ? 'regular' : 'alto_risco';

      await this.prisma.scoreRisco.upsert({
        where:  { clientId },
        create: {
          clientId,
          scorePontualidade,
          scoreReparcelamentos,
          scoreQuitacoes,
          scoreGeral,
          classificacao,
          totalEmprestimos,
          totalQuitados,
          totalReparcelamentos,
          totalParcelasAtrasadas: totalAtrasadas,
        },
        update: {
          scorePontualidade,
          scoreReparcelamentos,
          scoreQuitacoes,
          scoreGeral,
          classificacao,
          totalEmprestimos,
          totalQuitados,
          totalReparcelamentos,
          totalParcelasAtrasadas: totalAtrasadas,
          calculadoEm: new Date(),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Falha ao recalcular score do cliente ${clientId}: ${msg}`);
    }
  }
}
