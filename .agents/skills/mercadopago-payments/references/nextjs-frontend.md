# Frontend Next.js — Checkout Bricks e Renderização

## SDK JS (client-side)

```bash
npm install @mercadopago/sdk-js
```

---

## Inicialização no Layout (`app/layout.tsx` ou `_app.tsx`)

```tsx
// Carrega o SDK JS do MP (necessário para Bricks e tokenização)
// Adicione no <head> via next/script:
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src="https://sdk.mercadopago.com/js/v2"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## Server Action — Criar Pagamento PIX

```typescript
// app/actions/payments.ts
'use server';

export async function createPixPayment(formData: FormData) {
  const res = await fetch(`${process.env.BACKEND_URL}/payments/pix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getServerToken()}`,
    },
    body: JSON.stringify({
      amount: Number(formData.get('amount')),
      description: formData.get('description'),
      externalReference: formData.get('orderId'),
      payerEmail: formData.get('email'),
      payerFirstName: formData.get('firstName'),
      payerLastName: formData.get('lastName'),
      payerCpf: formData.get('cpf'),
      expirationMinutes: 30,
    }),
  });

  if (!res.ok) throw new Error('Falha ao criar pagamento PIX');
  return res.json();
}
```

---

## Componente PIX Completo

```tsx
// components/PixCheckout.tsx
'use client';
import { useState } from 'react';
import { createPixPayment } from '@/app/actions/payments';
import { PixPayment } from './PixPayment'; // veja references/pix.md

export function PixCheckout({ orderId, amount }: { orderId: string; amount: number }) {
  const [pixData, setPixData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData(e.currentTarget);
      formData.append('orderId', orderId);
      formData.append('amount', String(amount));
      const data = await createPixPayment(formData);
      setPixData(data);
    } catch {
      setError('Erro ao gerar PIX. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (pixData) {
    return (
      <PixPayment
        qrCodeBase64={pixData.qrCodeBase64}
        qrCode={pixData.qrCode}
        expiresAt={pixData.expiresAt}
        onPaid={() => window.location.href = `/orders/${orderId}/success`}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input name="email" type="email" placeholder="E-mail" required className="input" />
      <input name="firstName" placeholder="Nome" required className="input" />
      <input name="lastName" placeholder="Sobrenome" required className="input" />
      <input name="cpf" placeholder="CPF (somente números)" required className="input" />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Gerando PIX...' : `Pagar R$ ${amount.toFixed(2)} com PIX`}
      </button>
      <p className="text-xs text-center text-gray-400">
        Valor: R$ {amount.toFixed(2)} · Válido por 30 min
      </p>
    </form>
  );
}
```

---

## Payment Brick (Checkout Headless com Cartão)

Use o Payment Brick para tokenizar cartão sem enviar dados para o seu servidor:

```tsx
// components/CardCheckout.tsx
'use client';
import { useEffect, useRef } from 'react';

interface CardCheckoutProps {
  publicKey: string;
  amount: number;
  onToken: (token: string, paymentMethodId: string, installments: number) => void;
}

export function CardCheckout({ publicKey, amount, onToken }: CardCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !(window as any).MercadoPago) return;

    const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
    const bricks = mp.bricks();

    bricks.create('cardPayment', 'card-payment-container', {
      initialization: {
        amount,
        payer: { email: '' },
      },
      callbacks: {
        onReady: () => {},
        onSubmit: async (cardFormData: any) => {
          onToken(
            cardFormData.token,
            cardFormData.payment_method_id,
            cardFormData.installments,
          );
        },
        onError: (error: any) => console.error(error),
      },
    });
  }, [publicKey, amount]);

  return <div id="card-payment-container" ref={containerRef} />;
}
```

---

## Rota API Next.js para Proxy de Status (evita CORS)

```typescript
// app/api/payments/[id]/status/route.ts
import { NextResponse } from 'next/server';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const res = await fetch(
    `${process.env.BACKEND_URL}/payments/pix/${params.id}/status`,
    { headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}` } },
  );
  const data = await res.json();
  return NextResponse.json(data);
}
```

---

## Variáveis de Ambiente Next.js

```env
# .env.local
NEXT_PUBLIC_MP_PUBLIC_KEY=APP_USR-xxxx   # exposta ao browser
BACKEND_URL=http://localhost:3001         # URL do NestJS
INTERNAL_API_TOKEN=xxxx                  # token server-to-server
```

⚠️ Só variáveis com prefixo `NEXT_PUBLIC_` ficam disponíveis no browser.
O `MP_ACCESS_TOKEN` jamais deve ter esse prefixo.

---

## Dashboard de Boletos (Next.js + Server Component)

```tsx
// app/admin/boletos/page.tsx
import { cookies } from 'next/headers';

async function getBoletos(type: 'overdue' | 'due-soon') {
  const token = cookies().get('admin-token')?.value;
  const res = await fetch(`${process.env.BACKEND_URL}/payments/boleto/${type}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return res.json();
}

export default async function BoletosDashboard() {
  const [overdue, dueSoon] = await Promise.all([
    getBoletos('overdue'),
    getBoletos('due-soon'),
  ]);

  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-xl font-bold text-red-600">
          ⚠️ Boletos Vencidos ({overdue.length})
        </h2>
        <BoletoTable payments={overdue} showManualWriteOff />
      </section>
      <section>
        <h2 className="text-xl font-bold text-yellow-600">
          🔔 A Vencer em 3 dias ({dueSoon.length})
        </h2>
        <BoletoTable payments={dueSoon} />
      </section>
    </div>
  );
}
```
