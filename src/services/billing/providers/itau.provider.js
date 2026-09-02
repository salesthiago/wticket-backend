import crypto from 'crypto';
import logger from '../../../utils/logger.js';

// Provedor Itaú — Pix Cobrança / Pix recorrente (não faz cartão).
//
// As credenciais (client_id, client_secret, certificado + chave mTLS, webhook
// secret, ambiente) vêm do payment-settings.service — configuráveis no painel
// super-admin, com fallback para as variáveis ITAU_* do .env.
//
// FASE 1: as chamadas HTTP reais (OAuth2 client-credentials + mTLS, endpoint
// de cobrança Pix, validação de assinatura do webhook conforme a doc do Itaú)
// ainda estão em modo sandbox/stub. A fiação da API real é a Fase 2.

export const itauProvider = {
  key: 'itau',
  supportedMethods: ['pix'],
  supportsRecurring: true,

  isConfigured(config) {
    const c = config || {};
    return !!(c.clientId && c.clientSecret && c.certificatePem && c.privateKeyPem);
  },

  async createCharge(request, config) {
    const providerBillingId = `itau-${crypto.randomUUID()}`;
    const recurring = !!request.recurring;

    logger.info(
      `Billing :: Itaú (sandbox) gerando cobrança Pix${recurring ? ' recorrente' : ''} ` +
      `p/ empresa ${request.companyId} (R$ ${request.amount})`
    );

    const tag = recurring ? 'DEV-SANDBOX-PIX-REC' : 'DEV-SANDBOX-PIX';
    return {
      provider: 'itau',
      providerBillingId,
      pix: {
        qrCode: `00020126${tag}-${providerBillingId}`,
        copyPaste: `dev-sandbox-pix-copy-paste-${providerBillingId}`,
        txid: providerBillingId.replace(/-/g, '').slice(0, 32),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      },
      amount: request.amount,
      status: 'pending',
      raw: { sandbox: true, environment: config?.environment || 'production' }
    };
  },

  // Webhook de cobrança do Itaú. Valida o HMAC-SHA256 sobre o corpo raw
  // (header x-itau-signature) e normaliza o evento.
  parseWebhook(rawBody, headers, _query, config) {
    const secret = config?.webhookSecret || 'dev-webhook-secret';
    const signature = headers['x-itau-signature'];
    const expected = crypto
      .createHmac('sha256', secret)
      .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8'))
      .digest('hex');

    if (!signature || signature !== expected) {
      throw Object.assign(new Error('Assinatura de webhook Itaú inválida'), { status: 401 });
    }

    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '{}')
    );

    // Sandbox: aceita { providerBillingId, status }. Fase 2: mapear o payload
    // real (numeroNossoNumero / txid / tipoLiquidacao) para o nosso Payment.
    const status =
      payload.status === 'paid' || payload.tipoLiquidacao ? 'paid' :
      payload.status === 'expired' ? 'expired' : 'cancelled';

    return {
      providerBillingId: payload.providerBillingId || payload.txid || payload.numeroNossoNumero,
      status,
      raw: payload
    };
  }
};

export default itauProvider;
