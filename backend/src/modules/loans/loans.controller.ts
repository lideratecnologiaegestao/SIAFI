import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanFilterDto } from './dto/loan-filter.dto';

interface AuthUser {
  id: number;
  username: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @Roles('admin', 'financeiro')
  findAll(@Query() filters: LoanFilterDto) {
    return this.loansService.findAll(filters);
  }

  @Get('stats')
  @Roles('admin', 'financeiro')
  getStats() {
    return this.loansService.getStats();
  }

  @Get(':id')
  @Roles('admin', 'financeiro', 'caixa')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.loansService.findById(id);
  }

  @Post()
  @Roles('admin', 'financeiro')
  create(@Body() dto: CreateLoanDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.loansService.create(dto, {
      userId: user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/cancel')
  @Roles('admin', 'financeiro')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.loansService.cancel(id, {
      userId: user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
