import { Body, Controller, Get, Post, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RenegociacoesService } from './renegociacoes.service';
import { CreateRenegociacaoDto } from './dto/create-renegociacao.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('renegociacoes')
export class RenegociacoesController {
  constructor(private readonly renegociacoesService: RenegociacoesService) {}

  @Get()
  @Roles('admin', 'financeiro')
  findAll(@Query('loanId') loanId?: string) {
    if (loanId) return this.renegociacoesService.findByLoan(Number(loanId));
    return this.renegociacoesService.findAll();
  }

  @Post()
  @Roles('admin', 'financeiro')
  create(@Body() dto: CreateRenegociacaoDto) {
    return this.renegociacoesService.create(dto);
  }
}
