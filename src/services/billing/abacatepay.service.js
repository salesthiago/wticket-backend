import axios from 'axios';
import crypto from 'crypto';
import { getConfig } from '../../config/abacatepay.js';
import logger from '../../utils/logger.js';

// Chave pública da AbacatePay usada para validar a assinatura HMAC-SHA256 dos
// webhooks (header X-Webhook-Signature, base64 sobre o corpo raw). Fonte: docs v2.
const WEBHOOK_PUBLIC_KEY = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

/**
 * Valida a assinatura HMAC do webhook sobre o corpo raw.
 * @param {Buffer|string} rawBody corpo exato recebido
 * @param {string} signatureFromHeader header X-Webhook-Signature (base64)
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signatureFromHeader) {
  if (!rawBody || !signatureFromHeader) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_PUBLIC_KEY)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'))
    .digest('base64');
  const A = Buffer.from(expected);
  const B = Buffer.from(signatureFromHeader);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

// Wrapper da API v2 da AbacatePay (https://api.abacatepay.com/v2).
// Modelo v2: cria-se um Product (com preço) e depois um Checkout que referencia
// o product por id. O envelope de resposta é { data, success, error }.

// Cliente HTTP autenticado. Lança 503 quando a chave não está configurada.
function client() {
  const { apiUrl, apiKey } = getConfig();
  if (!apiKey) {
    throw Object.assign(new Error('AbacatePay não configurada (defina ABACATEPAY_API_KEY)'), { status: 503 });
  }
  return axios.create({
    baseURL: apiUrl,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
}

// Normaliza erros do axios/AbacatePay numa Error com .status e mensagem legível.
function normalizeError(err, context) {
  if (err.response) {
    const body = err.response.data;
    const msg = body?.error || body?.message || JSON.stringify(body);
    logger.error(`AbacatePay :: ${context} falhou (${err.response.status})`, msg);
    return Object.assign(new Error(`AbacatePay: ${msg}`), { status: 502 });
  }
  logger.error(`AbacatePay :: ${context} sem resposta`, err.message);
  return Object.assign(new Error(`AbacatePay indisponível: ${err.message}`), { status: 502 });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 5xx transitórios e erros de rede valem retry; 4xx (payload inválido) não.
function isTransient(err) {
  if (!err.response) return true;                 // sem resposta = rede/timeout
  const status = err.response.status;
  return status === 502 || status === 503 || status === 504;
}

// POST com retry leve em 5xx/rede. Trata o envelope v2: se `success === false`
// ou `error` presente, lança erro. Retorna `data.data`.
async function post(path, body, context) {
  const MAX_ATTEMPTS = 3; // 1 + 2 retries
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data } = await client().post(path, body);
      if (data?.success === false || data?.error) {
        const e = data.error || 'erro desconhecido';
        throw Object.assign(new Error(`AbacatePay: ${typeof e === 'string' ? e : JSON.stringify(e)}`), { status: 502, _appError: true });
      }
      return data?.data ?? data;
    } catch (err) {
      if (err._appError) throw err;               // erro de negócio da API → não retenta
      if (!err.isAxiosError && !err.response) throw err;
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransient(err)) {
        const delay = 700 * attempt;
        logger.warn(`AbacatePay :: ${context} 5xx transitório (tentativa ${attempt}/${MAX_ATTEMPTS}), retry em ${delay}ms`);
        await sleep(delay);
        continue;
      }
      throw normalizeError(err, context);
    }
  }
  throw normalizeError(lastErr, context);
}

/**
 * Cria um produto no catálogo da AbacatePay. Quando `cycle` é informado, o produto
 * é recorrente (assinatura); sem `cycle`, é avulso.
 * @param {object} p
 * @param {string} p.externalId único no nosso sistema
 * @param {string} p.name
 * @param {number} p.price em CENTAVOS
 * @param {string} [p.cycle] WEEKLY|MONTHLY|QUARTERLY|SEMIANNUALLY|ANNUALLY
 * @param {string} [p.description]
 * @returns {Promise<object>} { id: 'prod_...', ... }
 */
export async function createProduct({ externalId, name, price, cycle, description }) {
  return post('/products/create', {
    externalId,
    name,
    price,
    currency: 'BRL',
    ...(cycle ? { cycle } : {}),
    ...(description ? { description } : {})
  }, 'createProduct');
}

/**
 * Cria/sincroniza um Customer no AbacatePay. taxId precisa ser CPF/CNPJ válido.
 * @returns {Promise<object>} { id: 'cust_...', ... }
 */
export async function createCustomer({ name, email, cellphone, taxId }) {
  const body = {};
  if (name) body.name = name;
  if (email) body.email = email;
  if (cellphone) body.cellphone = cellphone;
  if (taxId) body.taxId = String(taxId).replace(/\D/g, '');
  return post('/customers/create', body, 'createCustomer');
}

/**
 * Cria um Checkout de ASSINATURA recorrente. O produto referenciado precisa ter
 * `cycle`. Retorna a página hospedada (data.url) para o 1º pagamento.
 * @param {object} p
 * @param {Array<{id:string,quantity:number}>} p.items exatamente um item
 * @param {string} [p.customerId]
 * @param {string} [p.externalId]
 * @param {string} [p.returnUrl] / @param {string} [p.completionUrl]
 * @param {string[]} [p.methods] default ['CARD']
 * @returns {Promise<object>} { id: 'bill_...', url, amount, status, customerId, externalId }
 */
export async function createSubscription({ items, customerId, externalId, returnUrl, completionUrl, methods = ['CARD'] }) {
  return post('/subscriptions/create', {
    items,
    methods,
    ...(customerId ? { customerId } : {}),
    ...(externalId ? { externalId } : {}),
    ...(returnUrl ? { returnUrl } : {}),
    ...(completionUrl ? { completionUrl } : {})
  }, 'createSubscription');
}
