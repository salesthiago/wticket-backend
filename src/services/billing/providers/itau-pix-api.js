import https from 'https';
import crypto from 'crypto';
import axios from 'axios';
import logger from '../../../utils/logger.js';
import { getItauPixEndpoints } from '../../../config/payment.js';

// Cliente real da API PIX Recebimentos (cobrança imediata `cob`) do Itaú, usado
// pelo billing da PLATAFORMA (cobrança da assinatura das empresas).
//
// `config` é a config efetiva do Itaú já descriptografada (payment-settings):
//   { environment, clientId, clientSecret, certificatePem, privateKeyPem, pixKey, pixKeyType }

const tokenCache = new Map();

function httpError(message, status) {
  return Object.assign(new Error(message), { status: status || 502 });
}

function buildAgent(config) {
  if (!config?.certificatePem || !config?.privateKeyPem) {
    throw httpError('Certificado/chave mTLS do Itaú ausentes na configuração do billing.', 422);
  }
  return new https.Agent({ cert: config.certificatePem, key: config.privateKeyPem, keepAlive: true });
}

function cacheKey(config) {
  return `${config.clientId}:${config.environment}`;
}

async function getToken(config, { force = false } = {}) {
  const key = cacheKey(config);
  const cached = tokenCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now() + 30000) return cached.token;

  const ep = getItauPixEndpoints(config.environment);
  const agent = buildAgent(config);
  try {
    const res = await axios({
      method: 'POST',
      url: `${ep.authUrl}${ep.tokenPath}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret
      }).toString(),
      httpsAgent: agent,
      timeout: 30000,
      validateStatus: () => true
    });
    if (res.status < 200 || res.status >= 300 || !res.data?.access_token) {
      throw httpError(
        `Falha ao autenticar no Itaú PIX (HTTP ${res.status}): ${res.data?.error_description || res.data?.mensagem || 'sem access_token'}`,
        502
      );
    }
    const token = res.data.access_token;
    const ttl = Number(res.data.expires_in || 300) * 1000;
    tokenCache.set(key, { token, expiresAt: Date.now() + ttl });
    return token;
  } finally {
    agent.destroy();
  }
}

export function clearTokenCache(config) {
  if (config) tokenCache.delete(cacheKey(config));
  else tokenCache.clear();
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-itau-correlationID': crypto.randomUUID(),
    'x-itau-flowID': crypto.randomUUID()
  };
}

function devedorFromPayer(payer) {
  if (!payer) return undefined;
  const doc = String(payer.taxId || '').replace(/\D/g, '');
  if (!doc || !payer.name) return undefined;
  return doc.length === 11
    ? { cpf: doc, nome: payer.name }
    : { cnpj: doc, nome: payer.name };
}

/**
 * Cria/atualiza uma cobrança PIX imediata (`PUT /cob/{txid}`).
 * @returns {Promise<{ txid, pixCopiaECola, location, status, raw }>}
 */
export async function criarCobranca(config, { txid, amount, payer, expiracaoSegundos = 3600, solicitacao }) {
  const token = await getToken(config);
  const ep = getItauPixEndpoints(config.environment);
  const agent = buildAgent(config);

  const body = {
    calendario: { expiracao: expiracaoSegundos },
    valor: { original: Number(amount).toFixed(2) },
    chave: config.pixKey
  };
  const devedor = devedorFromPayer(payer);
  if (devedor) body.devedor = devedor;
  if (solicitacao) body.solicitacaoPagador = String(solicitacao).slice(0, 140);

  try {
    const res = await axios({
      method: 'PUT',
      url: `${ep.apiUrl}/cob/${encodeURIComponent(txid)}`,
      headers: authHeaders(token),
      data: body,
      httpsAgent: agent,
      timeout: 30000,
      validateStatus: () => true
    });

    if (res.status < 200 || res.status >= 300) {
      const msg = res.data?.mensagem
        || (Array.isArray(res.data?.violacoes) && res.data.violacoes.map(v => v.razao).join('; '))
        || `HTTP ${res.status}`;
      throw httpError(`Itaú recusou a criação da cobrança PIX (${res.status}): ${msg}`, 422);
    }

    const d = res.data || {};
    const pixCopiaECola = d.pixCopiaECola || d.pix_copia_e_cola || d.emv;
    const location = d.location || d.loc?.location;
    if (!pixCopiaECola) {
      logger.warn('Billing :: Itaú PIX criou a cob mas não retornou pixCopiaECola', d);
    }
    return {
      txid: d.txid || txid,
      pixCopiaECola,
      location,
      status: d.status || 'ATIVA',
      raw: d
    };
  } finally {
    agent.destroy();
  }
}

/** Consulta a situação de uma cobrança (`GET /cob/{txid}`). */
export async function consultarCobranca(config, txid) {
  const token = await getToken(config);
  const ep = getItauPixEndpoints(config.environment);
  const agent = buildAgent(config);
  try {
    const res = await axios({
      method: 'GET',
      url: `${ep.apiUrl}/cob/${encodeURIComponent(txid)}`,
      headers: authHeaders(token),
      httpsAgent: agent,
      timeout: 30000,
      validateStatus: () => true
    });
    if (res.status < 200 || res.status >= 300) {
      throw httpError(`Falha ao consultar a cobrança PIX no Itaú (HTTP ${res.status})`, 502);
    }
    return res.data;
  } finally {
    agent.destroy();
  }
}

export default { getToken, clearTokenCache, criarCobranca, consultarCobranca };
