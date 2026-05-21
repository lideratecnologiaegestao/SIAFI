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
import type { RequestUser } from '../auth/guards/supabase-auth.guard';
import { ConsultorService } from './consultor.service';
import { CreateIntencaoDto, AprovarIntencaoDto } from './dto/create-intencao.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('intencoes')
export class IntencaoController {
  constructor(private readonly consultorService: ConsultorService) {}

  @Get()
  @Roles('consultor', 'financeiro', 'admin')
  listar(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    return this.consultorService.listarIntencoes(user, status);
  }

  @Post()
  @Roles('consultor')
  criar(
    @Body() dto: CreateIntencaoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.consultorService.criarIntencao(dto, user);
  }

  @Patch(':id/aprovar')
  @Roles('financeiro', 'admin')
  aprovar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprovarIntencaoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.consultorService.aprovarIntencao(id, dto, user);
  }
}
