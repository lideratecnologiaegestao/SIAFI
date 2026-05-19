import { AmortizationType } from '@prisma/client';
import { IInstallmentCalculator } from '../interfaces/installment-calculator.interface';
import { PriceCalculator } from './price-calculator';
import { SACCalculator } from './sac-calculator';
import { SimpleCalculator } from './simple-calculator';

export class CalculatorFactory {
  static create(type: AmortizationType): IInstallmentCalculator {
    switch (type) {
      case AmortizationType.price:
        return new PriceCalculator();
      case AmortizationType.sac:
        return new SACCalculator();
      case AmortizationType.simples:
      default:
        return new SimpleCalculator();
    }
  }
}
