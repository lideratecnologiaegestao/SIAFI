import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.settingsService.findAll();
  }

  @Patch()
  @Roles('admin')
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.setMany(dto.entries);
  }
}
