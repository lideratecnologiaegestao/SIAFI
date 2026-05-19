import Decimal from 'decimal.js';
import { addMonthsSafe } from '../../../../common/utils/date.utils';
import {
  CalculatorInput,
  IInstallmentCalculator,
  InstallmentSchedule,
} from '../interfaces/installment-calculator.interface';

/**
 * Tabela Price (Sistema Francês de Amortização)
 *
 * PMT = PV × i / (1 − (1+i)^−n)
 *
 * Cada parcela tem valor constante (PMT). A parcela de juros
 * decresce e a de amortização cresce ao longo do tempo.
 * A última parcela absorve o resíduo de arredondamento.
 */
export class PriceCalculator implements IInstallmentCalculator {
  calculate({ principal, taxaMensal, numeroParcelas, dataInicio }: CalculatorInput): InstallmentSchedule[] {
    let pmt: Decimal;

    if (taxaMensal.isZero()) {
      pmt = principal.dividedBy(numeroParcelas).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      // (1 + i)^n
      const compoundFactor = taxaMensal.plus(1).pow(numeroParcelas);
      // PMT = PV × i × (1+i)^n / ((1+i)^n − 1)
      pmt = principal
        .times(taxaMensal)
        .times(compoundFactor)
        .dividedBy(compoundFactor.minus(1))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    const schedule: InstallmentSchedule[] = [];
    let saldoDevedor = principal;

    for (let n = 1; n <= numeroParcelas; n++) {
      const juros = saldoDevedor.times(taxaMensal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      if (n === numeroParcelas) {
        // Última parcela: quita o saldo restante sem acumular drift
        const ultimaAmortizacao = saldoDevedor;
        schedule.push({
          numero: n,
          valor: ultimaAmortizacao.plus(juros).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          valorPrincipal: ultimaAmortizacao,
          valorJuros: juros,
          saldoDevedor: new Decimal(0),
          dataVencimento: addMonthsSafe(dataInicio, n),
        });
        break;
      }

      const amortizacao = pmt.minus(juros);
      saldoDevedor = saldoDevedor.minus(amortizacao).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      schedule.push({
        numero: n,
        valor: pmt,
        valorPrincipal: amortizacao,
        valorJuros: juros,
        saldoDevedor,
        dataVencimento: addMonthsSafe(dataInicio, n),
      });
    }

    return schedule;
  }
}
