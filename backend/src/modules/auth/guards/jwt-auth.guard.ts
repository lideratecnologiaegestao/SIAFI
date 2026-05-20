import { Injectable } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

// Drop-in replacement: delegates to SupabaseAuthGuard.
// All existing @UseGuards(JwtAuthGuard) controllers work without modification.
@Injectable()
export class JwtAuthGuard extends SupabaseAuthGuard {}
