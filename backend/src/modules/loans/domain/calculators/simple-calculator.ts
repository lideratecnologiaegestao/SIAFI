import Decimal from 'decimal.js';
import { addMonthsSafe } from '../../../../common/utils/date.utils';
import {
  CalculatorInput,
  IInstallmentCalculator,
  InstallmentSchedule,
} from '../interfaces/installment-calculator.interface';

/**
 * Juros Simples — parcelas iguais calculadas linearmente sobre o principal.
 *
 * Total devido: PV + PV × i × n
 * PMT = Total / n  (arredondado para baixo, exceto na última parcela)
 *
 * A última parcela absorve o centavo de arredondamento para garantir
 * que a soma exata das parcelas = total devido.
 */
export class SimpleCalculator implements IInstallmentCalculator {
  calculate({ principal, taxaMensal, numeroParcelas, dataInicio }: CalculatorInput): InstallmentSchedule[] {
    const totalJuros = principal.times(taxaMensal).times(numeroParcelas);
    const totalDevido = principal.plus(totalJuros);

    // ROUND_DOWN evita que a soma das parcelas exceda o total
    const pmtBase = totalDevido
      .dividedBy(numeroParcelas)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);

    const ultimaParcela = totalDevido
      .minus(pmtBase.times(numeroParcelas - 1))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const principalPorParcela = principal
      .dividedBy(numeroParcelas)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);

    const jurosPorParcela = totalJuros
      .dividedBy(numeroParcelas)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return Array.from({ length: numeroParcelas }, (_, idx) => {
      const n = idx + 1;
      const isLast = n === numeroParcelas;
      const valor = isLast ? ultimaParcela : pmtBase;
      const saldo = principal
        .minus(principalPorParcela.times(n))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      return {
        numero: n,
        valor,
        valorPrincipal: principalPorParcela,
        valorJuros: jurosPorParcela,
        saldoDevedor: Decimal.max(saldo, 0),
        dataVencimento: addMonthsSafe(dataInicio, n),
      };
    });
  }
}
