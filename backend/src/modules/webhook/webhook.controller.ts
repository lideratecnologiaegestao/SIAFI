import { Controller, Post, Req, Res, HttpCode } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('mercadopago')
  @HttpCode(200)
  async mercadoPago(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = req.body as Record<string, unknown>;
    const signature = req.headers['x-signature'] as string | undefined;
    const requestId = req.headers['x-request-id'] as string | undefined;

    const result = await this.webhookService.processWebhook(payload, signature, requestId);

    if (!result.received) {
      res.status(401);
      return { status: 'invalid_signature' };
    }

    return { status: 'ok', processed: result.processed };
  }
}
