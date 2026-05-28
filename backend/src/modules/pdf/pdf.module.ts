import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { ExcelService } from './excel.service';
import { PdfController } from './pdf.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SettingsModule],
  // EmpresaModule é @Global() — EmpresaConfigService disponível sem importar
  providers: [PdfService, ExcelService],
  controllers: [PdfController],
  exports: [PdfService, ExcelService],
})
export class PdfModule {}
