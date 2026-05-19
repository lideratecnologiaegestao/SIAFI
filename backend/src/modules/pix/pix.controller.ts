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
import { PixService } from './pix.service';
import { GeneratePixDto } from './dto/generate-pix.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pix')
export class PixController {
  constructor(private readonly pixService: PixService) {}

  @Post('generate')
  @Roles('admin', 'financeiro')
  generate(@Body() dto: GeneratePixDto) {
    return this.pixService.generate(dto);
  }

  @Get('installment/:installmentId')
  @Roles('admin', 'financeiro', 'caixa')
  findByInstallment(
    @Param('installmentId', ParseIntPipe) installmentId: number,
  ) {
    return this.pixService.findByInstallment(installmentId);
  }

  @Get(':id/status')
  @Roles('admin', 'financeiro', 'caixa')
  checkStatus(@Param('id', ParseIntPipe) id: number) {
    return this.pixService.checkStatus(id);
  }
}
