import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { ExcelService } from './excel.service';
import { PdfController } from './pdf.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PdfService, ExcelService],
  controllers: [PdfController],
  exports: [PdfService, ExcelService],
})
export class PdfModule {}
