import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MfaService } from './mfa.service';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [UsersModule, PassportModule, SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, MfaService, LocalStrategy],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
