import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

// MFA enrollment/challenge happens on the frontend via supabase-js.
// This service exposes backend helpers: status check and factor listing.
@Injectable()
export class MfaService {
  constructor(private readonly supabase: SupabaseService) {}

  async listFactors(supabaseId: string): Promise<{ factorId: string; status: string }[]> {
    const { data, error } = await this.supabase.admin.auth.admin.mfa.listFactors({
      userId: supabaseId,
    });
    if (error) throw new BadRequestException('Erro ao listar fatores MFA');
    return (data?.factors ?? []).map((f) => ({ factorId: f.id, status: f.status }));
  }

  async deleteFactor(supabaseId: string, factorId: string): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.mfa.deleteFactor({
      userId: supabaseId,
      id: factorId,
    });
    if (error) throw new BadRequestException('Erro ao remover fator MFA');
  }

  roleRequiresMfa(role: string): boolean {
    return ['admin', 'financeiro'].includes(role);
  }
}
