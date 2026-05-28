import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmpresaConfigService } from './empresa-config.service';
import { EmpresaController } from './empresa.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  providers: [EmpresaConfigService],
  controllers: [EmpresaController],
  exports: [EmpresaConfigService],
})
export class EmpresaModule {}
