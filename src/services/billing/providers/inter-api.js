import https from 'https';
import axios from 'axios';
import logger from '../../../utils/logger.js';
import { getInterEndpoints } from '../../../config/payment.js';

// Cliente da API PJ do Banco Inter, usado pelo billing da PLATAFORMA
// (cobrança da assinatura das empresas). Cobre:
//   - Pix imediato           PUT  /pix/v2/cob/{txid}
//   - Boleto com Pix (v3)    POST /cobranca/v3/cobrancas  (+ GET p/ obter linha digitável/EMV)
//   - PDF do boleto          GET  /cobranca/v3/cobrancas/{codigoSolicitacao}/pdf
//   - Cadastro de webhooks   PUT  /cobranca/v3/cobrancas/webhook | /pix/v2/webhook/{chave}
//
// `config` é a config efetiva do Inter já descriptografada (payment-settings):
//   { environment, clientId, clientSecret, certificatePem, privateKeyPem,
//     contaCorrente?, pixKey? }
//
// O Inter exige mTLS em todas as chamadas (inclusive sandbox) e o token OAuth é
// emitido por escopo — pedimos só o escopo de cada operação, assim um app sem
// Pix habilitado ainda consegue emitir boleto (e vice-versa).

export const INTER_SCOPES = {
  pix: 'cob.write cob.read',
  pixWebhook: 'webhook.write webhook.read',
  boleto: 'boleto-cobranca.write boleto-cobranca.read'
};

const tokenCache = new Map();

function httpError(message, status) {
  return Object.assign(new Error(message), { status: status || 502 });
}

function buildAgent(config) {
  if (!config?.certificatePem || !config?.privateKeyPem) {
    throw httpError('Certificado/chave mTLS do Inter ausentes na configuração do billing.', 422);
  }
  return new https.Agent({ cert: config.certificatePem, key: config.privateKeyPem, keepAlive: true });
}

function cacheKey(config, scope) {
  return `${config.clientId}:${config.environment}:${scope}`;
}

// Resumo legível do corpo de erro do Inter ({ title, detail, violacoes[] }).
function describeInterError(data) {
  if (data == null || data === '') return '(corpo vazio)';
  if (typeof data === 'string') return data.slice(0, 500);
  const parts = [data.title, data.detail].filter(Boolean);
  if (Array.isArray(data.violacoes) && data.violacoes.length) {
    parts.push(data.violacoes.map(v => [v.propriedade, v.razao].filter(Boolean).join(': ')).join('; '));
  }
  if (parts.length) return parts.join(' — ');
  if (data.error_description || data.error) return data.error_description || data.error;
  try { return JSON.stringify(data).slice(0, 500); } catch { return String(data).slice(0, 500); }
}

async function safeAxios(opts) {
  try {
    return await axios({ timeout: 20000, maxRedirects: 0, validateStatus: () => true, ...opts });
  } catch (err) {
    // Erro de rede/DNS/TLS/timeout — nunca deixar virar 5xx nem rejeição não tratada.
    logger.error(`Billing :: Inter falha de rede em ${opts.method} ${opts.url} :: ${err.code || ''} ${err.message}`);
    throw httpError(
      `Não foi possível conectar ao Inter (${err.code || err.message}). Verifique o ambiente e o certificado.`,
      422
    );
  }
}

async function getToken(config, scope) {
  const key = cacheKey(config, scope);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.token;

  const ep = getInterEndpoints(config.environment);
  const agent = buildAgent(config);
  try {
    const url = `${ep.apiUrl}${ep.tokenPath}`;
    logger.info(`Billing :: Inter OAuth POST ${url} (scope=${scope})`);
    const res = await safeAxios({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope
      }).toString(),
      httpsAgent: agent
    });
    if (res.status < 200 || res.status >= 300 || !res.data?.access_token) {
      logger.error(`Billing :: Inter OAuth falhou HTTP ${res.status} :: ${describeInterError(res.data)}`);
      throw httpError(
        `Falha ao autenticar no Inter (HTTP ${res.status}): ${describeInterError(res.data)}` +
        ` — confira se o app tem o escopo "${scope}" habilitado.`,
        422
      );
    }
    const token = res.data.access_token;
    const ttl = Number(res.data.expires_in || 3600) * 1000;
    tokenCache.set(key, { token, expiresAt: Date.now() + ttl });
    return token;
  } finally {
    agent.destroy();
  }
}

export function clearTokenCache() {
  tokenCache.clear();
}

async function request(config, { method, path, body, scope, operation }) {
  const token = await getToken(config, scope);
  const ep = getInterEndpoints(config.environment);
  const agent = buildAgent(config);
  const url = `${ep.apiUrl}${path}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (config.contaCorrente) headers['x-conta-corrente'] = config.contaCorrente;
  try {
    logger.info(`Billing :: Inter ${method} ${url}`);
    const res = await safeAxios({ method, url, headers, data: body, httpsAgent: agent });
    if (res.status < 200 || res.status >= 300) {
      logger.error(`Billing :: Inter ${operation} HTTP ${res.status} @ ${url} :: ${describeInterError(res.data)}`);
      // Sempre 422: falha do provedor externo não é erro do nosso servidor.
      throw httpError(`Inter recusou ${operation} (HTTP ${res.status}): ${describeInterError(res.data)}`, 422);
    }
    return res.data;
  } finally {
    agent.destroy();
  }
}

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function devedorFromPayer(payer) {
  const doc = onlyDigits(payer?.taxId);
  if (!doc || !payer?.name) return undefined;
  return doc.length === 11 ? { cpf: doc, nome: payer.name } : { cnpj: doc, nome: payer.name };
}

// ─── Pix imediato ─────────────────────────────────────────────────────────

/**
 * Cria a cobrança Pix imediata (`PUT /pix/v2/cob/{txid}`).
 * @returns {Promise<{ txid, pixCopiaECola, location, status, raw }>}
 */
export async function criarCobrancaPix(config, { txid, amount, payer, expiracaoSegundos, solicitacao }) {
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
    path: `/pix/v2/cob/${encodeURIComponent(txid)}`,
    body,
    scope: INTER_SCOPES.pix,
    operation: 'a criação da cobrança Pix'
  }) || {};

  return {
    txid: d.txid || txid,
    pixCopiaECola: d.pixCopiaECola,
    location: d.location || d.loc?.location,
    status: d.status || 'ATIVA',
    raw: d
  };
}

/** Consulta a cobrança Pix (`GET /pix/v2/cob/{txid}`) — status ATIVA | CONCLUIDA | REMOVIDA_*. */
export async function consultarCobrancaPix(config, txid) {
  return request(config, {
    method: 'GET',
    path: `/pix/v2/cob/${encodeURIComponent(txid)}`,
    scope: INTER_SCOPES.pix,
    operation: 'a consulta da cobrança Pix'
  });
}

// ─── Boleto com Pix (Cobrança v3) ─────────────────────────────────────────

function pagadorFromPayer(payer) {
  const doc = onlyDigits(payer?.taxId);
  const addr = payer?.address || {};
  const cep = onlyDigits(addr.zipCode);
  const missing = [];
  if (!doc) missing.push('CPF/CNPJ');
  if (!payer?.name) missing.push('nome');
  if (!addr.street) missing.push('logradouro');
  if (!addr.city) missing.push('cidade');
  if (!addr.state) missing.push('UF');
  if (cep.length !== 8) missing.push('CEP');
  if (missing.length) {
    throw httpError(
      `Para emitir boleto, complete o cadastro da empresa: ${missing.join(', ')}.`,
      422
    );
  }

  const pagador = {
    cpfCnpj: doc,
    tipoPessoa: doc.length === 11 ? 'FISICA' : 'JURIDICA',
    nome: String(payer.name).slice(0, 100),
    endereco: String(addr.street).slice(0, 90),
    cidade: String(addr.city).slice(0, 60),
    uf: String(addr.state).toUpperCase().slice(0, 2),
    cep
  };
  if (addr.number) pagador.numero = String(addr.number).slice(0, 10);
  if (addr.complement) pagador.complemento = String(addr.complement).slice(0, 30);
  if (addr.neighborhood) pagador.bairro = String(addr.neighborhood).slice(0, 60);
  if (payer.email) pagador.email = String(payer.email).slice(0, 50);
  // DDD + número (8 ou 9 dígitos), sem o DDI 55.
  const phone = onlyDigits(payer.phone).replace(/^55(?=\d{10,11}$)/, '');
  if (phone.length === 10 || phone.length === 11) {
    pagador.ddd = phone.slice(0, 2);
    pagador.telefone = phone.slice(2);
  }
  return pagador;
}

function toIsoDate(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Consulta a cobrança (`GET /cobranca/v3/cobrancas/{codigoSolicitacao}`). */
export async function consultarBoleto(config, codigoSolicitacao) {
  return request(config, {
    method: 'GET',
    path: `/cobranca/v3/cobrancas/${encodeURIComponent(codigoSolicitacao)}`,
    scope: INTER_SCOPES.boleto,
    operation: 'a consulta do boleto'
  });
}

/** Normaliza o GET da cobrança v3 no shape usado pelo Payment.boleto. */
export function normalizeBoleto(d = {}) {
  return {
    situacao: d.cobranca?.situacao,
    nossoNumero: d.boleto?.nossoNumero,
    codigoBarras: d.boleto?.codigoBarras,
    linhaDigitavel: d.boleto?.linhaDigitavel,
    pixCopiaECola: d.pix?.pixCopiaECola,
    txid: d.pix?.txid
  };
}

/**
 * Emite um boleto com Pix (BolePix). A emissão no Inter é assíncrona: o POST só
 * devolve o `codigoSolicitacao` e a linha digitável/EMV aparecem no GET em
 * alguns segundos. Tentamos algumas vezes; se ainda não estiver pronto, quem
 * chamou grava o código e completa depois (refreshBoleto).
 * @returns {Promise<{ codigoSolicitacao, seuNumero, dueDate, ...normalizeBoleto }>}
 */
export async function emitirBoleto(config, { seuNumero, amount, dueDate, payer, mensagem, numDiasAgenda = 30 }) {
  const body = {
    seuNumero,
    valorNominal: Number(Number(amount).toFixed(2)),
    dataVencimento: toIsoDate(dueDate),
    numDiasAgenda,
    pagador: pagadorFromPayer(payer)
  };
  if (mensagem) body.mensagem = { linha1: String(mensagem).slice(0, 78) };

  const created = await request(config, {
    method: 'POST',
    path: '/cobranca/v3/cobrancas',
    body,
    scope: INTER_SCOPES.boleto,
    operation: 'a emissão do boleto'
  }) || {};
  const codigoSolicitacao = created.codigoSolicitacao;
  if (!codigoSolicitacao) throw httpError('Inter não retornou o código da solicitação do boleto.', 502);

  let info = {};
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(attempt === 0 ? 800 : 1500);
    try {
      info = normalizeBoleto(await consultarBoleto(config, codigoSolicitacao));
    } catch (err) {
      logger.warn(`Billing :: Inter boleto ${codigoSolicitacao} ainda indisponível p/ consulta: ${err.message}`);
      continue;
    }
    if (info.situacao === 'FALHA_EMISSAO') {
      throw httpError('O Inter não conseguiu emitir o boleto (FALHA_EMISSAO). Verifique os dados do pagador.', 422);
    }
    if (info.linhaDigitavel) break;
  }

  return { codigoSolicitacao, seuNumero, dueDate: new Date(dueDate), ...info };
}

/** PDF do boleto em base64 (`GET .../{codigoSolicitacao}/pdf`). */
export async function obterPdfBoleto(config, codigoSolicitacao) {
  const d = await request(config, {
    method: 'GET',
    path: `/cobranca/v3/cobrancas/${encodeURIComponent(codigoSolicitacao)}/pdf`,
    scope: INTER_SCOPES.boleto,
    operation: 'o download do PDF do boleto'
  });
  if (!d?.pdf) throw httpError('Inter não retornou o PDF do boleto.', 502);
  return Buffer.from(d.pdf, 'base64');
}

// ─── Webhooks ─────────────────────────────────────────────────────────────

export async function registrarWebhookBoleto(config, webhookUrl) {
  return request(config, {
    method: 'PUT',
    path: '/cobranca/v3/cobrancas/webhook',
    body: { webhookUrl },
    scope: INTER_SCOPES.boleto,
    operation: 'o cadastro do webhook de boletos'
  });
}

// O Inter (padrão Bacen) acrescenta "/pix" à URL cadastrada ao chamar o webhook Pix.
export async function registrarWebhookPix(config, webhookUrl) {
  return request(config, {
    method: 'PUT',
    path: `/pix/v2/webhook/${encodeURIComponent(config.pixKey)}`,
    body: { webhookUrl },
    scope: INTER_SCOPES.pixWebhook,
    operation: 'o cadastro do webhook Pix'
  });
}

export default {
  clearTokenCache,
  criarCobrancaPix,
  consultarCobrancaPix,
  emitirBoleto,
  consultarBoleto,
  normalizeBoleto,
  obterPdfBoleto,
  registrarWebhookBoleto,
  registrarWebhookPix
};
