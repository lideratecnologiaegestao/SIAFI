# PIX — QR Code e Copia e Cola

## Endpoint da API MP
`POST https://api.mercadopago.com/v1/payments`
`payment_method_id: "pix"`

---

## `pix.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MP_CLIENT } from './payments.module';
import { v4 as uuid } from 'uuid';

export interface CreatePixPaymentDto {
  amount: number;
  description: string;
  externalReference: string;   // seu ID interno
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
  payerCpf: string;            // CPF sem pontuação
  expirationMinutes?: number;  // padrão: 30 minutos
}

export interface PixPaymentResult {
  paymentId: number;
  status: string;
  qrCodeBase64: string;        // imagem PNG em base64
  qrCode: string;              // string Copia e Cola
  expiresAt: string;           // ISO 8601
}

@Injectable()
export class PixService {
  private paymentClient: Payment;

  constructor(@Inject(MP_CLIENT) private mpConfig: MercadoPagoConfig) {
    this.paymentClient = new Payment(mpConfig);
  }

  async createPixPayment(dto: CreatePixPaymentDto): Promise<PixPaymentResult> {
    const expiresAt = new Date(
      Date.now() + (dto.expirationMinutes ?? 30) * 60 * 1000,
    ).toISOString();

    const response = await this.paymentClient.create({
      body: {
        transaction_amount: dto.amount,
        description: dto.description,
        payment_method_id: 'pix',
        external_reference: dto.externalReference,
        date_of_expiration: expiresAt,
        notification_url: `${process.env.MP_NOTIFICATION_URL}?source_news=webhooks`,
        payer: {
          email: dto.payerEmail,
          first_name: dto.payerFirstName,
          last_name: dto.payerLastName,
          identification: { type: 'CPF', number: dto.payerCpf },
        },
      },
      requestOptions: { idempotencyKey: uuid() },
    });

    const txData = response.point_of_interaction?.transaction_data;

    return {
      paymentId: response.id!,
      status: response.status!,
      qrCodeBase64: txData?.qr_code_base64 ?? '',
      qrCode: txData?.qr_code ?? '',
      expiresAt,
    };
  }

  async getPixStatus(paymentId: number) {
    const payment = await this.paymentClient.get({ id: paymentId });
    return {
      status: payment.status,
      statusDetail: payment.status_detail,
      paidAt: payment.date_approved,
    };
  }

  /** Cancela um PIX pendente */
  async cancelPixPayment(paymentId: number) {
    return this.paymentClient.cancel({ id: paymentId });
  }
}
```

---

## Controller — Rotas PIX

```typescript
// payments.controller.ts (trecho PIX)
@Post('pix')
async createPix(@Body() dto: CreatePixPaymentDto) {
  const result = await this.pixService.createPixPayment(dto);
  // Salve no banco antes de retornar:
  // await this.db.payment.create({ data: { mpId: result.paymentId, ... } })
  return result;
}

@Get('pix/:paymentId/status')
async getPixStatus(@Param('paymentId') id: string) {
  return this.pixService.getPixStatus(Number(id));
}
```

---

## Frontend Next.js — Renderizar QR Code

```tsx
// components/PixPayment.tsx
'use client';
import { useState, useEffect } from 'react';

interface PixPaymentProps {
  qrCodeBase64: string;
  qrCode: string;       // Copia e Cola
  expiresAt: string;
  onPaid?: () => void;
}

export function PixPayment({ qrCodeBase64, qrCode, expiresAt, onPaid }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (new Date() > new Date(expiresAt)) {
        setExpired(true);
        clearInterval(interval);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (expired) return <p>PIX expirado. Gere um novo pagamento.</p>;

  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src={`data:image/png;base64,${qrCodeBase64}`}
        alt="QR Code PIX"
        width={240}
        height={240}
      />
      <p className="text-sm text-gray-500 text-center break-all max-w-xs">{qrCode}</p>
      <button onClick={handleCopy} className="btn-primary">
        {copied ? '✓ Copiado!' : 'Copiar código PIX'}
      </button>
      <p className="text-xs text-gray-400">
        Válido até: {new Date(expiresAt).toLocaleTimeString('pt-BR')}
      </p>
    </div>
  );
}
```

---

## Polling de Status no Frontend

Use polling com intervalo de 5s enquanto o pagamento for `pending`:

```typescript
// hooks/usePixPolling.ts
import { useEffect, useState } from 'react';

export function usePixPolling(paymentId: number, intervalMs = 5000) {
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    if (status !== 'pending') return;

    const id = setInterval(async () => {
      const res = await fetch(`/api/payments/pix/${paymentId}/status`);
      const data = await res.json();
      setStatus(data.status);
      if (data.status === 'approved') clearInterval(id);
    }, intervalMs);

    return () => clearInterval(id);
  }, [paymentId, status]);

  return status;
}
```

---

## Resposta Raw do MP (campos importantes)

```json
{
  "id": 5466310457,
  "status": "pending",
  "status_detail": "pending_waiting_transfer",
  "point_of_interaction": {
    "type": "PIX",
    "transaction_data": {
      "qr_code_base64": "iVBORw0KGgo...",
      "qr_code": "00020126600014br.gov.bcb.pix...",
      "ticket_url": "https://www.mercadopago.com.br/payments/5466310457/ticket?..."
    }
  }
}
```

---

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `400 Bad Request` | CPF inválido ou campo faltando | Valide com `class-validator` antes |
| `401 Unauthorized` | `ACCESS_TOKEN` errado | Cheque o env e se está em modo correto (sandbox vs prod) |
| `QR Code em branco` | `qr_code_base64` vazio em sandbox | Use credenciais de produção com usuário de teste |
| PIX expirado | Prazo venceu | Reemita com novo `expirationMinutes` |
