import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService, NotificationList } from './notifications.service';
import { NotificationFilterDto } from './dto/notification-filter.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles('admin', 'financeiro')
  findAll(@Query() query: NotificationFilterDto): Promise<NotificationList> {
    return this.notificationsService.findAll(query.page ?? 1, query.limit ?? 20, query.clientId);
  }
}
