import crypto from 'crypto';
import logger from '../../../utils/logger.js';
import { criarCobranca } from './itau-pix-api.js';

// Provedor Itaú — PIX (cobrança imediata via API PIX Recebimentos). Não faz cartão.
//
// As credenciais (client_id, client_secret, certificado + chave mTLS, chave PIX,
// webhook secret, ambiente) vêm do payment-settings.service — configuráveis no
// painel super-admin, com fallback para as variáveis ITAU_* do .env.

// txid PIX: [a-zA-Z0-9]{26,35}. 16 bytes hex = 32 chars.
function newTxid() {
  return crypto.randomBytes(16).toString('hex');
}

export const itauProvider = {
  key: 'itau',
  supportedMethods: ['pix'],
  supportsRecurring: true,

  isConfigured(config) {
    const c = config || {};
    return !!(c.clientId && c.clientSecret && c.certificatePem && c.privateKeyPem && c.pixKey);
  },

  async createCharge(request, config) {
    if (!this.isConfigured(config)) {
      throw Object.assign(
        new Error('Itaú PIX não está totalmente configurado (credenciais, certificado mTLS e chave PIX são obrigatórios).'),
        { status: 422 }
      );
    }

    const txid = newTxid();
    logger.info(
      `Billing :: Itaú PIX (${config.environment}) criando cobrança ${txid} ` +
      `p/ empresa ${request.companyId} (R$ ${request.amount})`
    );

    const cob = await criarCobranca(config, {
      txid,
      amount: request.amount,
      payer: request.payer,
      expiracaoSegundos: 3600,
      solicitacao: 'Assinatura WTicket'
    });

    const emv = cob.pixCopiaECola;
    if (!emv) {
      throw Object.assign(new Error('Itaú não retornou o PIX copia-e-cola da cobrança.'), { status: 502 });
    }

    return {
      provider: 'itau',
      providerBillingId: cob.txid,
      pix: {
        qrCode: emv,          // o front gera a imagem do QR a partir deste EMV
        copyPaste: emv,
        txid: cob.txid,
        location: cob.location,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      },
      amount: request.amount,
      status: 'pending',
      raw: { environment: config.environment, cob: cob.raw }
    };
  },

  // Webhook do Itaú PIX Recebimentos. Normaliza para { providerBillingId, status, raw }.
  //
  // Formatos aceitos:
  //   { pix: [ { txid, endToEndId, valor, horario } ] }   -> liquidação (paid)
  //   { txid, status: 'CONCLUIDA' | 'REMOVIDA_PELO_PSP' }  -> mudança de status da cob
  parseWebhook(rawBody, headers, _query, config) {
    // Assinatura HMAC opcional (só validada quando há webhookSecret configurado).
    if (config?.webhookSecret) {
      const signature = headers['x-itau-signature'] || headers['x-hub-signature-256'];
      const expected = crypto
        .createHmac('sha256', config.webhookSecret)
        .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8'))
        .digest('hex');
      if (!signature || signature.replace(/^sha256=/, '') !== expected) {
        throw Object.assign(new Error('Assinatura de webhook Itaú inválida'), { status: 401 });
      }
    }

    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '{}')
    );

    if (Array.isArray(payload.pix) && payload.pix.length) {
      const entry = payload.pix[0];
      return {
        providerBillingId: entry.txid,
        status: 'paid',
        raw: payload
      };
    }

    const st = String(payload.status || '').toUpperCase();
    const status =
      st === 'CONCLUIDA' ? 'paid' :
      st === 'REMOVIDA_PELO_PSP' || st === 'REMOVIDA_PELO_USUARIO_RECEBEDOR' ? 'expired' :
      'cancelled';

    return {
      providerBillingId: payload.txid,
      status,
      raw: payload
    };
  }
};

export default itauProvider;
