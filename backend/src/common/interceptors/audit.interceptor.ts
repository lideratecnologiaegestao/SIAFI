import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { sanitizarDadosAudit } from '../../modules/lgpd/lgpd.service';

// Roles que geram trilha de auditoria automática em toda escrita
const AUDITED_ROLES = new Set(['admin', 'financeiro', 'caixa']);
// Apenas mutações — leituras (GET/HEAD/OPTIONS) não são auditadas aqui
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id: number; role: string } }>();
    const { user, method, url, ip, headers } = req;

    if (!user || !AUDITED_ROLES.has(user.role) || !WRITE_METHODS.has(method)) {
      return next.handle();
    }

    const acao = `${method} ${url}`;

    const rawBody = (req as any).body;
    const dados =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
        ? sanitizarDadosAudit(rawBody as Record<string, unknown>)
        : undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget: falha no log não deve derrubar a resposta principal
          void this.auditService
            .log({
              userId: user.id,
              acao,
              ip,
              userAgent: headers['user-agent'] as string | undefined,
              dados,
            })
            .catch(() => undefined);
        },
      }),
    );
  }
}
