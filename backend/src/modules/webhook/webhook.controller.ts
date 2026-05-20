import * as crypto from 'crypto';
import { Controller, Post, Req, Headers, Body, HttpCode, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { QUEUE_PAYMENT_PROCESSING, JOB_PAYMENT_WEBHOOK } from '../queue/queue.constants';
import type { PaymentJobData } from '../queue/queue.interfaces';

interface MpWebhookBody {
  action?: string;
  data?: { id: string };
  live_mode?: boolean;
  type?: string;
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @InjectQueue(QUEUE_PAYMENT_PROCESSING)
    private readonly paymentQueue: Queue<PaymentJobData>,
  ) {}

  @Post('mercadopago')
  @HttpCode(200)
  async mercadoPago(
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: MpWebhookBody,
    @Req() req: Request,
  ): Promise<{ received: boolean }> {
    const isLive = body.live_mode === true;
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (isLive && secret && signature && requestId) {
      const valid = this.validateSignature(signature, requestId, secret);
      if (!valid) {
        this.logger.warn(`Webhook MP com assinatura inválida — requestId=${requestId}`);
        throw new UnauthorizedException('Assinatura inválida');
      }
    }

    const paymentId = body?.data?.id?.toString();

    if (body.type !== 'payment' || !paymentId) {
      return { received: true };
    }

    await this.paymentQueue.add(
      JOB_PAYMENT_WEBHOOK,
      {
        paymentId,
        externalReference: paymentId,
        status: body.action ?? 'unknown',
        amount: 0,
        origem: 'webhook',
      },
      {
        jobId: `mp-${paymentId}`, // idempotência — previne duplo processamento
        priority: 1,
      },
    );

    this.logger.log(`Webhook MP enfileirado: paymentId=${paymentId}`);
    return { received: true };
  }

  private validateSignature(signature: string, requestId: string, secret: string): boolean {
    try {
      const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const ts = parts['ts'] ?? '';
      const manifest = `id=${requestId}&ts=${ts}`;
      const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(parts['v1'] ?? '', 'hex');

      if (expectedBuf.length !== receivedBuf.length) return false;

      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }
}
