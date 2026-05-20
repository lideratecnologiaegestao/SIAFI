import { Injectable, NestMiddleware } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Verifica assinatura HS256 sem dependência externa
function verifyJwtHS256(token: string, secret: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token malformado');

  const sigInput = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', secret).update(sigInput).digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) {
    throw new Error('Assinatura inválida');
  }

  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
}

@Injectable()
export class AdminQueueMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Autenticação necessária para acessar /admin/queues' });
      return;
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET ?? '';

    try {
      const payload = verifyJwtHS256(token, secret);

      if (payload.role !== 'admin') {
        res.status(403).json({ message: 'Acesso restrito a administradores' });
        return;
      }

      next();
    } catch {
      res.status(401).json({ message: 'Token inválido' });
    }
  }
}
