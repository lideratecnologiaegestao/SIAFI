import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientsService } from './clients.service';
import type { UploadedFiles as ClientUploadedFiles } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientFilterDto } from './dto/client-filter.dto';

const fileStorage = diskStorage({
  destination: './uploads/clients',
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const uploadInterceptor = FileFieldsInterceptor(
  [
    { name: 'foto', maxCount: 1 },
    { name: 'rg', maxCount: 1 },
    { name: 'comprovante', maxCount: 1 },
  ],
  { storage: fileStorage },
);

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Roles('admin', 'financeiro', 'caixa')
  findAll(@Query() filters: ClientFilterDto) {
    return this.clientsService.findAll(filters);
  }

  @Get('stats')
  @Roles('admin', 'financeiro')
  getStats() {
    return this.clientsService.getStats();
  }

  @Get('quitados')
  @Roles('admin', 'financeiro')
  findQuitados() {
    return this.clientsService.findQuitados();
  }

  @Get(':id')
  @Roles('admin', 'financeiro', 'caixa')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findById(id);
  }

  @Post()
  @Roles('admin', 'financeiro')
  @UseInterceptors(uploadInterceptor)
  create(
    @Body() dto: CreateClientDto,
    @UploadedFiles() files: ClientUploadedFiles,
  ) {
    return this.clientsService.create(dto, files);
  }

  @Patch(':id')
  @Roles('admin', 'financeiro')
  @UseInterceptors(uploadInterceptor)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @UploadedFiles() files: ClientUploadedFiles,
  ) {
    return this.clientsService.update(id, dto, files);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.softDelete(id);
  }
}
