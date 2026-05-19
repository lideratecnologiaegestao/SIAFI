import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads/clients',
    }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
