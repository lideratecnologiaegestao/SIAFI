import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PdfService } from './pdf.service';
import { ExcelService } from './excel.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly excelService: ExcelService,
  ) {}

  // ─── PDF ─────────────────────────────────────────────────────────────────

  @Get('contratos/:id/pdf')
  @Roles('admin', 'financeiro')
  async contratoPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.pdfService.gerarContratoEmprestimo(id, res);
  }

  @Get('pagamentos/:id/recibo')
  @Roles('admin', 'financeiro', 'caixa')
  async reciboPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.pdfService.gerarReciboPagamento(id, res);
  }

  // ─── Excel ───────────────────────────────────────────────────────────────

  @Get('contratos/excel')
  @Roles('admin', 'financeiro')
  async contratosExcel(
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    await this.excelService.exportarContratos(status, res);
  }

  @Get('movimentacao/excel')
  @Roles('admin', 'financeiro')
  async movimentacaoExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    await this.excelService.exportarMovimentacao(startDate, endDate, res);
  }

  @Get('inadimplentes/excel')
  @Roles('admin', 'financeiro')
  async inadimplentesExcel(@Res() res: Response) {
    await this.excelService.exportarInadimplentes(res);
  }
}
