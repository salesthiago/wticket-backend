import https from 'https';
import crypto from 'crypto';
import axios from 'axios';
import logger from '../../../utils/logger.js';
import { resolveItauEndpoints } from '../../../config/itau.js';
import itauLogRepository from '../../../repositories/financial/itau/itau-integration-log.repository.js';

// Cliente HTTP real da API Cobrança v2 do Itaú (OAuth2 client_credentials + mTLS).
//
// `config` aqui é a configuração EFETIVA e já descriptografada de UMA empresa:
//   { companyId, environment, clientId, clientSecret, certificatePem, privateKeyPem }
//
// Toda requisição é registrada em itau-integration-log (tela Histórico de Integração).

// Cache de token em memória, por (companyId + clientId + environment).
const tokenCache = new Map();

function cacheKey(config) {
  return `${config.companyId}:${config.clientId}:${config.environment}`;
}

function buildHttpsAgent(config) {
  if (!config.certificatePem || !config.privateKeyPem) {
    throw httpError('Certificado/chave mTLS do Itaú ausentes na configuração.', 422);
  }
  return new https.Agent({
    cert: config.certificatePem,
    key: config.privateKeyPem,
    keepAlive: true
  });
}

function httpError(message, status) {
  return Object.assign(new Error(message), { status: status || 502 });
}

// Remove segredos antes de gravar no log de auditoria.
function sanitize(payload) {
  if (payload == null) return payload;
  let obj;
  try {
    obj = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(JSON.stringify(payload));
  } catch {
    return typeof payload === 'string' ? payload.slice(0, 4000) : payload;
  }
  const REDACT = /(secret|senha|password|authorization|client_secret|access_token|token)/i;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return node;
    for (const k of Object.keys(node)) {
      if (REDACT.test(k)) node[k] = '***';
      else if (typeof node[k] === 'object') walk(node[k]);
      else if (typeof node[k] === 'string' && node[k].length > 2000) node[k] = node[k].slice(0, 2000) + '…';
    }
    return node;
  };
  return walk(obj);
}

async function recordLog(entry) {
  await itauLogRepository.create(entry);
}

/**
 * Executa uma requisição HTTP e grava um log de integração.
 * @returns {Promise<{ status:number, data:any }>}
 */
async function call(config, { operation, method, url, headers, data, boletoId, receivableId }) {
  const started = Date.now();
  const agent = buildHttpsAgent(config);
  let httpStatus = 0;
  let responseBody;
  let success = false;
  let errorMessage;

  try {
    const res = await axios({
      method,
      url,
      headers,
      data,
      httpsAgent: agent,
      timeout: 30000,
      validateStatus: () => true
    });
    httpStatus = res.status;
    responseBody = res.data;
    success = res.status >= 200 && res.status < 300;
    if (!success) {
      errorMessage = extractItauError(res.data) || `HTTP ${res.status}`;
    }
    return { status: res.status, data: res.data, success, errorMessage };
  } catch (err) {
    errorMessage = err.message;
    responseBody = { error: err.message, code: err.code };
    throw httpError(`Falha na comunicação com o Itaú: ${err.message}`, 502);
  } finally {
    agent.destroy();
    await recordLog({
      companyId: config.companyId,
      boletoId: boletoId || null,
      receivableId: receivableId || null,
      operation,
      method,
      url,
      environment: config.environment,
      requestBody: sanitize(data),
      responseBody: sanitize(responseBody),
      httpStatus,
      durationMs: Date.now() - started,
      success,
      errorMessage
    });
  }
}

function extractItauError(data) {
  if (!data || typeof data !== 'object') return null;
  // Formatos observados na doc do Itaú: { codigo, mensagem } | { campos:[{mensagem}] }
  if (data.mensagem) return data.mensagem;
  if (Array.isArray(data.campos) && data.campos.length) {
    return data.campos.map(c => c.mensagem || c.descricao).filter(Boolean).join('; ');
  }
  if (data.error_description) return data.error_description;
  return null;
}

// ─── OAuth2 ──────────────────────────────────────────────────────────────────

export async function getAccessToken(config, { force = false } = {}) {
  const key = cacheKey(config);
  const cached = tokenCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now() + 30000) {
    return cached.token;
  }

  const ep = resolveItauEndpoints(config.environment);
  const url = `${ep.authUrl}${ep.tokenPath}`;
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret
  });

  const { data, success, status, errorMessage } = await call(config, {
    operation: 'oauth_token',
    method: 'POST',
    url,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: form.toString()
  });

  if (!success || !data?.access_token) {
    throw httpError(`Não foi possível autenticar no Itaú (HTTP ${status}): ${errorMessage || 'sem access_token'}`, 502);
  }

  const token = data.access_token;
  const ttl = Number(data.expires_in || 300) * 1000;
  tokenCache.set(key, { token, expiresAt: Date.now() + ttl });
  return token;
}

export function clearTokenCache(config) {
  if (config) tokenCache.delete(cacheKey(config));
  else tokenCache.clear();
}

// ─── API Cobrança v2 ─────────────────────────────────────────────────────────

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-itau-correlationID': crypto.randomUUID(),
    'x-itau-flowID': crypto.randomUUID()
  };
}

/**
 * Registra (efetiva) um boleto de cobrança com QR Code Pix.
 * `payload` deve seguir o contrato { data: { ... } } da API Cobrança v2.
 */
export async function registrarBoleto(config, payload, { receivableId } = {}) {
  const token = await getAccessToken(config);
  const ep = resolveItauEndpoints(config.environment);
  const url = `${ep.apiUrl}${ep.boletosPath}`;

  const { data, success, status, errorMessage } = await call(config, {
    operation: 'registrar_boleto',
    method: 'POST',
    url,
    headers: authHeaders(token),
    data: payload,
    receivableId
  });

  if (!success) {
    throw httpError(`Itaú recusou o registro do boleto (HTTP ${status}): ${errorMessage || 'erro desconhecido'}`, 422);
  }
  return data;
}

/**
 * Consulta a situação de um boleto pelo id_boleto (nosso número + carteira).
 */
export async function consultarBoleto(config, idBoleto, { boletoId, receivableId } = {}) {
  const token = await getAccessToken(config);
  const ep = resolveItauEndpoints(config.environment);
  const url = `${ep.apiUrl}${ep.boletosPath}/${encodeURIComponent(idBoleto)}`;

  const { data, success, status, errorMessage } = await call(config, {
    operation: 'consultar_boleto',
    method: 'GET',
    url,
    headers: authHeaders(token),
    boletoId,
    receivableId
  });

  if (!success) {
    throw httpError(`Falha ao consultar o boleto no Itaú (HTTP ${status}): ${errorMessage || 'erro'}`, 502);
  }
  return data;
}

/**
 * Solicita a baixa (cancelamento) de um boleto.
 */
export async function baixarBoleto(config, idBoleto, { boletoId, receivableId } = {}) {
  const token = await getAccessToken(config);
  const ep = resolveItauEndpoints(config.environment);
  const url = `${ep.apiUrl}${ep.boletosPath}/${encodeURIComponent(idBoleto)}/baixa`;

  const { data, success, status, errorMessage } = await call(config, {
    operation: 'baixar_boleto',
    method: 'POST',
    url,
    headers: authHeaders(token),
    data: { data: { codigo_baixa: '2' } }, // 2 = "Pago/Baixa por solicitação"
    boletoId,
    receivableId
  });

  if (!success) {
    throw httpError(`Falha ao baixar o boleto no Itaú (HTTP ${status}): ${errorMessage || 'erro'}`, 502);
  }
  return data;
}

export default { getAccessToken, clearTokenCache, registrarBoleto, consultarBoleto, baixarBoleto };
