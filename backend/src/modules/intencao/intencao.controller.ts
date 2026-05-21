import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IntencaoService } from './intencao.service';
import { CreateIntencaoDto } from './dto/create-intencao.dto';
import { AprovarIntencaoDto } from './dto/aprovar-intencao.dto';
import { RejeitarIntencaoDto } from './dto/rejeitar-intencao.dto';
import { FeedbackIntencaoDto } from './dto/feedback-intencao.dto';

interface AuthUser { id: number; username: string; role: string }

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('intencoes')
export class IntencaoController {
  constructor(private readonly intencaoService: IntencaoService) {}

  // Consultor submete uma intenção de empréstimo
  @Post()
  @Roles('consultor', 'admin', 'financeiro')
  criar(@Body() dto: CreateIntencaoDto, @CurrentUser() user: AuthUser) {
    return this.intencaoService.criar(dto, user.id);
  }

  // Listagem: financeiro/admin vê todas; consultor vê as suas
  @Get()
  @Roles('admin', 'financeiro', 'consultor')
  findAll(
    @Query('status') status?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const consultorId = user?.role === 'consultor' ? user.id : undefined;
    return this.intencaoService.findAll({ status, consultorId });
  }

  @Get(':id')
  @Roles('admin', 'financeiro', 'consultor')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.intencaoService.findById(id);
  }

  @Patch(':id/aprovar')
  @Roles('admin', 'financeiro')
  aprovar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprovarIntencaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.intencaoService.aprovar(id, dto, user.id);
  }

  @Patch(':id/rejeitar')
  @Roles('admin', 'financeiro')
  rejeitar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejeitarIntencaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.intencaoService.rejeitar(id, dto, user.id);
  }

  @Patch(':id/feedback')
  @Roles('consultor', 'admin', 'financeiro')
  registrarFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FeedbackIntencaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.intencaoService.registrarFeedback(id, dto, user.id);
  }
}
