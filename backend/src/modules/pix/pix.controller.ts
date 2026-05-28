import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PixService } from './pix.service';
import { GeneratePixDto } from './dto/generate-pix.dto';
import type { RequestUser } from '../auth/guards/supabase-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pix')
export class PixController {
  constructor(private readonly pixService: PixService) {}

  @Post('generate')
  @Roles('admin', 'financeiro', 'caixa')
  generate(@Body() dto: GeneratePixDto, @CurrentUser() user: RequestUser) {
    return this.pixService.generate(dto, user);
  }

  @Post(':id/reissue')
  @Roles('admin', 'financeiro')
  reissue(@Param('id', ParseIntPipe) id: number) {
    return this.pixService.reissue(id);
  }

  @Get('installment/:installmentId')
  @Roles('admin', 'financeiro', 'caixa')
  findByInstallment(@Param('installmentId', ParseIntPipe) installmentId: number) {
    return this.pixService.findByInstallment(installmentId);
  }

  @Get(':id/status')
  @Roles('admin', 'financeiro', 'caixa')
  checkStatus(@Param('id', ParseIntPipe) id: number) {
    return this.pixService.checkStatus(id);
  }
}
