import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/supabase-auth.guard';
import { PortalService } from './portal.service';

class DesativarPortalDto {
  @IsString()
  @IsNotEmpty()
  motivo: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients/:id/portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('status')
  @Roles('admin', 'financeiro', 'consultor')
  getStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.portalService.getStatus(id, user);
  }

  @Post('ativar')
  @Roles('admin', 'financeiro', 'consultor')
  ativar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.portalService.ativarPortal(id, user);
  }

  @Post('desativar')
  @Roles('admin', 'financeiro')
  desativar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DesativarPortalDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.portalService.desativarPortal(id, user, dto.motivo);
  }

  @Post('reativar')
  @Roles('admin', 'financeiro')
  reativar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.portalService.reativarPortal(id, user);
  }

  @Post('reenviar-senha')
  @Roles('admin', 'financeiro', 'consultor')
  reenviarSenha(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.portalService.reenviarSenha(id, user);
  }
}
