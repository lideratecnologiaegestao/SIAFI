# Credenciais, Ambientes e Configuração de Testes

## Tipos de Credenciais

| Credencial | Onde usar | Como obter |
|-----------|-----------|-----------|
| `ACCESS_TOKEN` | Server-side (NestJS) — NUNCA no browser | Painel MP → Suas integrações → Credenciais |
| `PUBLIC_KEY` | Client-side (Next.js) | Mesmo local |
| `WEBHOOK_SECRET` | Validação de assinatura | Painel MP → Aplicação → Webhooks |

## Ambientes

- **Sandbox (teste)**: credenciais de teste, dinheiro fictício
- **Produção**: credenciais reais, dinheiro real

As credenciais de sandbox e produção são **diferentes**. Troque antes de ir ao ar.

---

## Criar Usuários de Teste

Crie via API com seu `ACCESS_TOKEN` de **produção**:

```bash
curl -X POST \
  https://api.mercadopago.com/users/test \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_PRODUCAO" \
  -H "Content-Type: application/json" \
  -d '{ "site_id": "MLB" }'
```

Crie **dois**: um como vendedor (use o `access_token` dele no backend de testes),
outro como comprador (use o `email` dele nos pagamentos).

---

## Cartões de Teste (Sandbox)

| Bandeira | Número | CVV | Vencimento | Nome do portador |
|----------|--------|-----|-----------|-----------------|
| Mastercard ✅ aprovado | 5031 4332 1540 6351 | 123 | 11/25 | APRO |
| Visa ✅ aprovado | 4235 6477 2802 5682 | 123 | 11/25 | APRO |
| Mastercard ❌ recusado | 5031 4332 1540 6351 | 123 | 11/25 | OTHE |
| Sem fundos ❌ | 4000 0000 0000 0002 | 123 | 11/25 | FUND |

Use `identification.type: "CPF"` e `number: "19119119100"` para testes.

---

## Configuração NestJS por Ambiente

```typescript
// config/mercadopago.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('mercadopago', () => ({
  accessToken: process.env.MP_ACCESS_TOKEN,
  publicKey: process.env.MP_PUBLIC_KEY,
  webhookSecret: process.env.MP_WEBHOOK_SECRET,
  notificationUrl: process.env.MP_NOTIFICATION_URL,
  isSandbox: process.env.NODE_ENV !== 'production',
}));
```

```typescript
// payments.module.ts — use ConfigService
{
  provide: MP_CLIENT,
  useFactory: (config: ConfigService) =>
    new MercadoPagoConfig({
      accessToken: config.get('mercadopago.accessToken'),
      options: {
        timeout: 10_000,
        idempotencyKey: undefined, // por pagamento, não global
      },
    }),
  inject: [ConfigService],
},
```

---

## Checklist de Migração Sandbox → Produção

- [ ] Substituir credenciais de teste pelas de produção no `.env`
- [ ] Atualizar `MP_NOTIFICATION_URL` para a URL real (HTTPS obrigatório)
- [ ] Configurar o Webhook no painel com a URL de produção
- [ ] Ativar o segredo do webhook e salvar em `MP_WEBHOOK_SECRET`
- [ ] Testar um pagamento real com valor mínimo (R$ 0,50)
- [ ] Verificar que o webhook está sendo recebido e processado
- [ ] Remover qualquer log que imprima o `ACCESS_TOKEN`

---

## Endpoints da API MP

| Recurso | Endpoint |
|---------|----------|
| Criar pagamento | `POST /v1/payments` |
| Consultar pagamento | `GET /v1/payments/{id}` |
| Cancelar pagamento | `PUT /v1/payments/{id}` com `{"status":"cancelled"}` |
| Criar plano | `POST /preapproval_plan` |
| Criar assinatura | `POST /preapproval` |
| Atualizar assinatura | `PUT /preapproval/{id}` |
| Consultar métodos de pagamento | `GET /v1/payment_methods` |
| Criar preferência | `POST /checkout/preferences` |

Base URL: `https://api.mercadopago.com`

---

## Rate Limits (aproximados)

| Endpoint | Limite |
|----------|--------|
| `/v1/payments` (POST) | 50 req/s por usuário |
| `/v1/payments/{id}` (GET) | 300 req/s |
| `/preapproval*` | 50 req/s |

Use `X-Idempotency-Key` em POST para retentativas seguras sem duplicatas.

---

## Links da Documentação Oficial

- Pagamentos: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing
- PIX: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix
- Boleto: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/other-payment-methods
- Assinaturas: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscriptions-associated-plan
- Webhooks: https://www.mercadopago.com.br/developers/pt/docs/notifications
- SDK Node.js: https://github.com/mercadopago/sdk-nodejs
- Referência API: https://www.mercadopago.com.br/developers/pt/reference
