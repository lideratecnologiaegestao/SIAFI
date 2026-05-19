import Decimal from 'decimal.js';
import { addMonthsSafe } from '../../../../common/utils/date.utils';
import {
  CalculatorInput,
  IInstallmentCalculator,
  InstallmentSchedule,
} from '../interfaces/installment-calculator.interface';

/**
 * SAC — Sistema de Amortização Constante
 *
 * Amortização fixa: A = PV / n
 * Juros decrescentes: J_k = Saldo_k × i
 * Parcela decrescente: PMT_k = A + J_k
 *
 * A última parcela absorve o resíduo de arredondamento do principal.
 */
export class SACCalculator implements IInstallmentCalculator {
  calculate({ principal, taxaMensal, numeroParcelas, dataInicio }: CalculatorInput): InstallmentSchedule[] {
    const amortizacaoBase = principal
      .dividedBy(numeroParcelas)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);

    const schedule: InstallmentSchedule[] = [];
    let saldoDevedor = principal;
    let totalAmortizado = new Decimal(0);

    for (let n = 1; n <= numeroParcelas; n++) {
      const juros = saldoDevedor.times(taxaMensal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Última parcela quita exatamente o que restar do principal
      const amortizacao = n === numeroParcelas
        ? principal.minus(totalAmortizado)
        : amortizacaoBase;

      saldoDevedor = saldoDevedor.minus(amortizacao).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalAmortizado = totalAmortizado.plus(amortizacao);

      schedule.push({
        numero: n,
        valor: amortizacao.plus(juros).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        valorPrincipal: amortizacao,
        valorJuros: juros,
        saldoDevedor: Decimal.max(saldoDevedor, 0),
        dataVencimento: addMonthsSafe(dataInicio, n),
      });
    }

    return schedule;
  }
}
