import Decimal from 'decimal.js';

export interface InstallmentSchedule {
  numero: number;
  valor: Decimal;
  valorPrincipal: Decimal;
  valorJuros: Decimal;
  saldoDevedor: Decimal;
  dataVencimento: Date;
}

export interface CalculatorInput {
  principal: Decimal;
  taxaMensal: Decimal; // fração — ex: 0.05 para 5% a.m.
  numeroParcelas: number;
  dataInicio: Date;
}

export interface IInstallmentCalculator {
  calculate(input: CalculatorInput): InstallmentSchedule[];
}
