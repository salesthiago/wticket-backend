import https from 'https';
import crypto from 'crypto';
import axios from 'axios';
import logger from '../../../utils/logger.js';
import { getItauPixEndpoints } from '../../../config/payment.js';

// Cliente real da API PIX Recebimentos (cobrança imediata `cob`) do Itaú, usado
// pelo billing da PLATAFORMA (cobrança da assinatura das empresas).
//
// `config` é a config efetiva do Itaú já descriptografada (payment-settings):
//   { environment, clientId, clientSecret, certificatePem, privateKeyPem,
//     pixKey, pixKeyType, apikey?, pixScope? }

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

// Resumo legível do corpo de resposta do Itaú (para log e mensagem de erro).
function describeItauError(data) {
  if (data == null || data === '') return '(corpo vazio)';
  if (typeof data === 'string') return data.slice(0, 500);
  if (data.mensagem) return data.mensagem;
  if (data.detail || data.title) return [data.title, data.detail].filter(Boolean).join(' — ');
  if (data.error_description || data.error) return data.error_description || data.error;
  if (Array.isArray(data.violacoes) && data.violacoes.length) {
    return data.violacoes.map(v => v.razao || v.propriedade).filter(Boolean).join('; ');
  }
  try { return JSON.stringify(data).slice(0, 500); } catch { return String(data).slice(0, 500); }
}

// Headers de diagnóstico que o gateway do Itaú costuma devolver.
function pickDiagHeaders(headers = {}) {
  const keep = ['www-authenticate', 'x-itau-correlationid', 'x-itau-flowid', 'x-3scale-error', 'x-app-name'];
  const out = {};
  for (const k of Object.keys(headers)) {
    if (keep.includes(k.toLowerCase())) out[k] = headers[k];
  }
  return out;
}

async function safeAxios(opts) {
  try {
    return await axios({ timeout: 20000, maxRedirects: 0, validateStatus: () => true, ...opts });
  } catch (err) {
    // Erro de rede/DNS/TLS/timeout — nunca deixar virar 5xx nem rejeição não tratada.
    logger.error(`Billing :: Itaú PIX falha de rede em ${opts.method} ${opts.url} :: ${err.code || ''} ${err.message}`);
    throw httpError(
      `Não foi possível conectar ao Itaú PIX (${err.code || err.message}). Verifique o host/ambiente configurado.`,
      422
    );
  }
}

async function getToken(config, { force = false } = {}) {
  const key = cacheKey(config);
  const cached = tokenCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now() + 30000) return cached.token;

  const ep = getItauPixEndpoints(config.environment);
  const agent = buildAgent(config);
  const form = {
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret
  };
  if (config.pixScope) form.scope = config.pixScope;

  try {
    const url = `${ep.authUrl}${ep.tokenPath}`;
    logger.info(`Billing :: Itaú PIX OAuth POST ${url} (scope=${config.pixScope || '—'})`);
    const res = await safeAxios({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams(form).toString(),
      httpsAgent: agent
    });
    if (res.status < 200 || res.status >= 300 || !res.data?.access_token) {
      logger.error(
        `Billing :: Itaú PIX OAuth falhou HTTP ${res.status} :: ${describeItauError(res.data)} :: ` +
        `headers=${JSON.stringify(pickDiagHeaders(res.headers))}`
      );
      throw httpError(
        `Falha ao autenticar no Itaú PIX (HTTP ${res.status}): ${describeItauError(res.data)}`,
        422
      );
    }
    const token = res.data.access_token;
    const ttl = Number(res.data.expires_in || 300) * 1000;
    tokenCache.set(key, { token, expiresAt: Date.now() + ttl });
    if (res.data.scope) logger.info(`Billing :: Itaú PIX token OK (scopes: ${res.data.scope})`);
    return token;
  } finally {
    agent.destroy();
  }
}

export function clearTokenCache(config) {
  if (config) tokenCache.delete(cacheKey(config));
  else tokenCache.clear();
}

function authHeaders(token, config) {
  const h = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-itau-correlationID': crypto.randomUUID(),
    'x-itau-flowID': crypto.randomUUID()
  };
  // O gateway 3scale do Itaú normalmente exige o apikey além do Bearer.
  // Default: o próprio client_id (comportamento mais comum). Sobrescreva com
  // ITAU_PIX_APIKEY se o app tiver um "User Key" distinto.
  const apikey = config?.apikey || config?.clientId;
  if (apikey) {
    h['x-itau-apikey'] = apikey;
    h.apikey = apikey;
  }
  return h;
}

function devedorFromPayer(payer) {
  if (!payer) return undefined;
  const doc = String(payer.taxId || '').replace(/\D/g, '');
  if (!doc || !payer.name) return undefined;
  return doc.length === 11
    ? { cpf: doc, nome: payer.name }
    : { cnpj: doc, nome: payer.name };
}

async function request(config, { method, path, body, operation }) {
  const token = await getToken(config);
  const ep = getItauPixEndpoints(config.environment);
  const agent = buildAgent(config);
  const url = `${ep.apiUrl}${path}`;
  try {
    logger.info(`Billing :: Itaú PIX ${method} ${url}`);
    const res = await safeAxios({
      method,
      url,
      headers: authHeaders(token, config),
      data: body,
      httpsAgent: agent
    });

    if (res.status < 200 || res.status >= 300) {
      logger.error(
        `Billing :: Itaú PIX ${operation} HTTP ${res.status} @ ${url} :: ${describeItauError(res.data)} :: ` +
        `headers=${JSON.stringify(pickDiagHeaders(res.headers))}`
      );
      const hint = res.status === 403
        ? ' (403 costuma ser apikey ausente/incorreta, host de produção errado, ou o app sem o produto "PIX Recebimentos"/escopo cob.write habilitado)'
        : '';
      // Sempre 422: falha do provedor externo não é erro do nosso servidor.
      throw httpError(
        `Itaú recusou ${operation} (HTTP ${res.status}): ${describeItauError(res.data)}${hint}`,
        422
      );
    }
    return res.data;
  } finally {
    agent.destroy();
  }
}

/**
 * Cria/atualiza uma cobrança PIX imediata (`PUT /cob/{txid}`).
 * @returns {Promise<{ txid, pixCopiaECola, location, status, raw }>}
 */
export async function criarCobranca(config, { txid, amount, payer, expiracaoSegundos = 3600, solicitacao }) {
  const body = {
    calendario: { expiracao: expiracaoSegundos },
    valor: { original: Number(amount).toFixed(2) },
    chave: config.pixKey
  };
  const devedor = devedorFromPayer(payer);
  if (devedor) body.devedor = devedor;
  if (solicitacao) body.solicitacaoPagador = String(solicitacao).slice(0, 140);

  const d = await request(config, {
    method: 'PUT',
    path: `/cob/${encodeURIComponent(txid)}`,
    body,
    operation: 'a criação da cobrança PIX'
  }) || {};

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
}

/** Consulta a situação de uma cobrança (`GET /cob/{txid}`). */
export async function consultarCobranca(config, txid) {
  return request(config, {
    method: 'GET',
    path: `/cob/${encodeURIComponent(txid)}`,
    operation: 'a consulta da cobrança PIX'
  });
}

export default { getToken, clearTokenCache, criarCobranca, consultarCobranca };
