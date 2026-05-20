import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InstallmentsService } from './installments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get('overdue')
  @Roles('admin', 'financeiro', 'caixa')
  findOverdue() {
    return this.installmentsService.findOverdue();
  }

  @Get(':id')
  @Roles('admin', 'financeiro', 'caixa')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.findById(id);
  }
}
