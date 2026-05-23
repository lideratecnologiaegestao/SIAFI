import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('movimentacao')
  @Roles('admin', 'financeiro')
  getMovimentacao(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getMovimentacao(startDate, endDate);
  }

  @Get('carteira')
  @Roles('admin', 'financeiro')
  getCarteira() {
    return this.reportsService.getCarteira();
  }

  @Get('clientes')
  @Roles('admin', 'financeiro')
  getClientes() {
    return this.reportsService.getClientes();
  }

  @Get('contratos')
  @Roles('admin', 'financeiro')
  getContratos(@Query('status') status?: string) {
    return this.reportsService.getContratos(status);
  }

  @Get('faturamento')
  @Roles('admin', 'financeiro')
  getFaturamento(@Query('mes') mes: string) {
    return this.reportsService.getFaturamentoMensal(mes);
  }

  @Get('evolucao')
  @Roles('admin', 'financeiro')
  getEvolucao(@Query('meses') meses?: string) {
    return this.reportsService.getEvolucao(Math.min(Math.max(Number(meses) || 6, 2), 12));
  }
}
