import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientPortalService } from './client-portal.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

interface AuthUser {
  id: number;
  username: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('cliente')
@Controller('portal')
export class ClientPortalController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.clientPortalService.getMyInfo(user.id);
  }

  @Get('loans')
  getLoans(@CurrentUser() user: AuthUser) {
    return this.clientPortalService.getMyLoans(user.id);
  }

  @Get('installments')
  getInstallments(@CurrentUser() user: AuthUser) {
    return this.clientPortalService.getMyInstallments(user.id);
  }

  @Get('tickets')
  getTickets(@CurrentUser() user: AuthUser) {
    return this.clientPortalService.getMyTickets(user.id);
  }

  @Post('tickets')
  createTicket(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.clientPortalService.createTicket(
      user.id,
      dto.assunto,
      dto.mensagem,
    );
  }
}
