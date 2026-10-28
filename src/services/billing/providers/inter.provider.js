import crypto from 'crypto';
import logger from '../../../utils/logger.js';
import {
  criarCobrancaPix,
  consultarCobrancaPix,
  emitirBoleto,
  consultarBoleto,
  normalizeBoleto
} from './inter-api.js';

// Provedor Banco Inter — Pix imediato (API Pix) e boleto com Pix / BolePix
// (API Cobrança v3). Não faz cartão.
//
// providerBillingId: txid (Pix) ou codigoSolicitacao (boleto).
//
// As credenciais (client_id, client_secret, certificado + chave mTLS, conta,
// chave Pix, ambiente) vêm do payment-settings.service — configuráveis no painel
// super-admin, com fallback para as variáveis INTER_* do .env.

const PIX_EXPIRATION_SECONDS = 24 * 3600;

// txid Pix: [a-zA-Z0-9]{26,35}. 16 bytes hex = 32 chars.
function newTxid() {
  return crypto.randomBytes(16).toString('hex');
}

// seuNumero do boleto: até 15 chars, único do nosso lado.
function newSeuNumero() {
  return (Date.now().toString(36) + crypto.randomBytes(3).toString('hex')).toUpperCase().slice(0, 15);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function asClientError(err, fallback) {
  logger.error(`Billing :: Inter createCharge falhou :: ${err.message}`);
  return Object.assign(new Error(err.message || fallback), {
    status: err.status && err.status < 500 ? err.status : 422
  });
}

// Situação da cobrança v3 → status normalizado. Situações "em aberto"
// (A_RECEBER, ATRASADO, EM_PROCESSAMENTO, PROTESTO) não mudam o Payment.
function boletoStatus(situacao) {
  const s = String(situacao || '').toUpperCase();
  if (s === 'RECEBIDO' || s === 'MARCADO_RECEBIDO') return 'paid';
  if (s === 'CANCELADO') return 'cancelled';
  if (s === 'EXPIRADO') return 'expired';
  return null;
}

function pixStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'CONCLUIDA') return 'paid';
  if (s.startsWith('REMOVIDA')) return 'expired';
  return null;
}

export const interProvider = {
  key: 'inter',
  supportedMethods: ['pix', 'boleto'],
  supportsRecurring: false,

  isConfigured(config) {
    const c = config || {};
    return !!(c.clientId && c.clientSecret && c.certificatePem && c.privateKeyPem);
  },

  /** Métodos que a config atual consegue processar (Pix exige chave Pix). */
  isMethodConfigured(method, config) {
    if (!this.isConfigured(config)) return false;
    return method === 'pix' ? !!config.pixKey : true;
  },

  async createCharge(request, config) {
    if (!this.isMethodConfigured(request.method, config)) {
      throw Object.assign(
        new Error(
          request.method === 'pix'
            ? 'Inter Pix não está configurado (credenciais, certificado mTLS e chave Pix são obrigatórios).'
            : 'Inter não está configurado (credenciais e certificado mTLS são obrigatórios).'
        ),
        { status: 422 }
      );
    }
    return request.method === 'boleto'
      ? this._createBoleto(request, config)
      : this._createPix(request, config);
  },

  async _createPix(request, config) {
    const txid = newTxid();
    logger.info(
      `Billing :: Inter Pix (${config.environment}) criando cobrança ${txid} ` +
      `p/ empresa ${request.companyId} (R$ ${request.amount})`
    );

    let cob;
    try {
      cob = await criarCobrancaPix(config, {
        txid,
        amount: request.amount,
        payer: request.payer,
        expiracaoSegundos: PIX_EXPIRATION_SECONDS,
        solicitacao: request.description || 'Assinatura WTicket'
      });
    } catch (err) {
      throw asClientError(err, 'Falha ao gerar a cobrança Pix no Inter');
    }
    if (!cob.pixCopiaECola) {
      throw Object.assign(new Error('Inter não retornou o Pix copia-e-cola da cobrança.'), { status: 502 });
    }

    return {
      provider: 'inter',
      providerBillingId: cob.txid,
      pix: {
        qrCode: cob.pixCopiaECola,   // o front gera a imagem do QR a partir deste EMV
        copyPaste: cob.pixCopiaECola,
        txid: cob.txid,
        expiresAt: new Date(Date.now() + PIX_EXPIRATION_SECONDS * 1000)
      },
      amount: request.amount,
      status: 'pending',
      raw: { environment: config.environment, cob: cob.raw }
    };
  },

  async _createBoleto(request, config) {
    const seuNumero = newSeuNumero();
    const dueDate = request.dueDate
      ? new Date(request.dueDate)
      : addDays(new Date(), Number(config.boletoDueDays) || 3);
    logger.info(
      `Billing :: Inter boleto (${config.environment}) emitindo ${seuNumero} ` +
      `p/ empresa ${request.companyId} (R$ ${request.amount})`
    );

    let b;
    try {
      b = await emitirBoleto(config, {
        seuNumero,
        amount: request.amount,
        dueDate,
        payer: request.payer,
        mensagem: request.description || 'Assinatura WTicket'
      });
    } catch (err) {
      throw asClientError(err, 'Falha ao emitir o boleto no Inter');
    }

    return {
      provider: 'inter',
      providerBillingId: b.codigoSolicitacao,
      boleto: {
        codigoSolicitacao: b.codigoSolicitacao,
        seuNumero: b.seuNumero,
        nossoNumero: b.nossoNumero,
        linhaDigitavel: b.linhaDigitavel,
        codigoBarras: b.codigoBarras,
        dueDate: b.dueDate
      },
      // BolePix: o mesmo boleto também pode ser pago pelo Pix copia-e-cola.
      pix: b.pixCopiaECola
        ? { qrCode: b.pixCopiaECola, copyPaste: b.pixCopiaECola, txid: b.txid, expiresAt: b.dueDate }
        : null,
      amount: request.amount,
      status: 'pending',
      raw: { environment: config.environment, situacao: b.situacao }
    };
  },

  /**
   * Completa um boleto cuja emissão ainda estava em processamento no checkout.
   * @returns {Promise<{ boleto, pix } | null>} null se ainda não estiver pronto
   */
  async refreshBoleto(codigoSolicitacao, config) {
    const b = normalizeBoleto(await consultarBoleto(config, codigoSolicitacao));
    if (!b.linhaDigitavel) return null;
    return {
      boleto: { linhaDigitavel: b.linhaDigitavel, codigoBarras: b.codigoBarras, nossoNumero: b.nossoNumero },
      pix: b.pixCopiaECola ? { qrCode: b.pixCopiaECola, copyPaste: b.pixCopiaECola, txid: b.txid } : null
    };
  },

  // Webhook do Inter. O Inter não assina o corpo — a URL cadastrada carrega um
  // token secreto no path (validado aqui) e o status é sempre reconfirmado na
  // API (confirmEvent) antes de liberar a assinatura.
  //
  // Diferente dos outros provedores, devolve uma LISTA de eventos: o Inter
  // agrupa várias cobranças no mesmo POST.
  //   Boleto: [ { codigoSolicitacao, situacao, ... } ]
  //   Pix:    { pix: [ { txid, endToEndId, valor, horario } ] }
  parseWebhook(rawBody, _headers, params, config) {
    const token = params?.token;
    const expected = config?.webhookToken;
    if (
      !expected || !token ||
      token.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    ) {
      throw Object.assign(new Error('Token de webhook Inter inválido'), { status: 401 });
    }

    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '{}')
    );

    if (Array.isArray(payload?.pix)) {
      return payload.pix
        .filter(e => e?.txid)
        .map(e => ({ kind: 'pix', providerBillingId: e.txid, status: 'paid', raw: e }));
    }

    const items = Array.isArray(payload) ? payload : [payload];
    return items
      .filter(e => e?.codigoSolicitacao)
      .map(e => ({ kind: 'boleto', providerBillingId: e.codigoSolicitacao, status: boletoStatus(e.situacao), raw: e }))
      .filter(e => e.status);
  },

  /** Reconsulta o Inter e devolve o evento com o status real (ou null se segue em aberto). */
  async confirmEvent(event, config) {
    const status = event.kind === 'pix'
      ? pixStatus((await consultarCobrancaPix(config, event.providerBillingId))?.status)
      : boletoStatus(normalizeBoleto(await consultarBoleto(config, event.providerBillingId)).situacao);
    return status ? { ...event, status } : null;
  }
};

export default interProvider;
