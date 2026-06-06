import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from '../../utils/logger.js';
import companyRepository from '../../repositories/company.repository.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.util.js';

const DEFAULT_PRESIGNED_EXPIRES_IN = 60 * 60; // 1h

// Cache de clientes S3 para evitar reconstruir a cada chamada
const _clientCache = new Map(); // chave: 'default' | `c:<companyId>`

// ─── Resolução de config (empresa > padrão) ───────────────────────────────────

function getDefaultConfig() {
  const cfg = {
    bucket: process.env.S3_DEFAULT_BUCKET,
    region: process.env.S3_DEFAULT_REGION,
    accessKeyId: process.env.S3_DEFAULT_ACCESS_KEY,
    secretAccessKey: process.env.S3_DEFAULT_SECRET_KEY,
    prefix: process.env.S3_DEFAULT_PREFIX || '',
    publicBaseUrl: process.env.S3_DEFAULT_PUBLIC_BASE_URL || '',
    endpoint: process.env.S3_DEFAULT_ENDPOINT || '',
    forcePathStyle: process.env.S3_DEFAULT_FORCE_PATH_STYLE === 'true'
  };
  if (!cfg.bucket || !cfg.region || !cfg.accessKeyId || !cfg.secretAccessKey) {
    return null;
  }
  return cfg;
}

/**
 * Resolve a configuração efetiva: empresa (se configurada e enabled) ou padrão.
 * @returns {Promise<{ source: 'company'|'default', config: object }|null>}
 */
async function resolveConfig(companyId) {
  if (companyId) {
    const company = await companyRepository.findById(companyId);
    const sc = company?.storageConfig;
    if (sc?.enabled && sc.bucket && sc.region && sc.accessKeyId && sc.secretAccessKeyEnc) {
      let secret;
      try {
        secret = decryptSecret(sc.secretAccessKeyEnc);
      } catch (err) {
        logger.error('S3 :: failed to decrypt company secret >> ', err?.message);
        // fallback para padrão
        const def = getDefaultConfig();
        return def ? { source: 'default', config: def } : null;
      }
      return {
        source: 'company',
        config: {
          bucket: sc.bucket,
          region: sc.region,
          accessKeyId: sc.accessKeyId,
          secretAccessKey: secret,
          prefix: sc.prefix || '',
          publicBaseUrl: sc.publicBaseUrl || '',
          endpoint: sc.endpoint || '',
          forcePathStyle: !!sc.forcePathStyle
        }
      };
    }
  }
  const def = getDefaultConfig();
  return def ? { source: 'default', config: def } : null;
}

function buildClient(config) {
  const opts = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  };
  if (config.endpoint) opts.endpoint = config.endpoint;
  if (config.forcePathStyle) opts.forcePathStyle = true;
  return new S3Client(opts);
}

async function getClient(companyId) {
  const cacheKey = companyId ? `c:${companyId}` : 'default';
  if (_clientCache.has(cacheKey)) return _clientCache.get(cacheKey);

  const resolved = await resolveConfig(companyId);
  if (!resolved) {
    throw new Error('Storage S3 não configurado (sem credenciais padrão e sem config da empresa)');
  }
  const client = buildClient(resolved.config);
  const entry = { client, config: resolved.config, source: resolved.source };
  _clientCache.set(cacheKey, entry);
  return entry;
}

export function invalidateCompanyCache(companyId) {
  if (companyId) _clientCache.delete(`c:${companyId}`);
}

export function invalidateAllCache() {
  _clientCache.clear();
}

// ─── Construção de chave (sempre companies/<companyId>/...) ───────────────────

/**
 * Sanitiza nome de arquivo: remove acentos, espaços → underscore, mantém só [A-Za-z0-9._-].
 */
export function sanitizeFilename(name) {
  if (!name) return 'file';
  const noAccent = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '');
  return noAccent.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
}

/**
 * Monta a chave S3 final, sempre prefixada por `<configPrefix>companies/<companyId>/<category>/<filename>`.
 */
export function buildKey({ companyId, category, filename, configPrefix = '' }) {
  if (!companyId) throw new Error('buildKey: companyId é obrigatório');
  if (!category) throw new Error('buildKey: category é obrigatório');
  const safe = sanitizeFilename(filename || 'file');
  const cleanPrefix = configPrefix
    ? configPrefix.replace(/^\/+|\/+$/g, '') + '/'
    : '';
  return `${cleanPrefix}companies/${companyId}/${category}/${safe}`;
}

// ─── Operações ────────────────────────────────────────────────────────────────

/**
 * Faz upload de um buffer para o bucket. Retorna metadata útil para persistir.
 *
 * @param {object} params
 * @param {string} params.companyId
 * @param {string} params.category   ex.: 'products', 'service-orders'
 * @param {string} params.filename   nome original ou sugerido
 * @param {Buffer} params.body
 * @param {string} [params.contentType]
 * @param {boolean} [params.publicRead] true → ACL pública (default: false)
 * @returns {Promise<{ key:string, url:string, source:'company'|'default', publicRead:boolean }>}
 */
export async function uploadObject({ companyId, category, filename, body, contentType, publicRead = false }) {
  const { client, config, source } = await getClient(companyId);

  const key = buildKey({ companyId, category, filename, configPrefix: config.prefix });

  const cmd = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    ACL: publicRead ? 'public-read' : undefined
  });

  await client.send(cmd);

  const url = publicRead ? buildPublicUrl(config, key) : null;

  return { key, url, source, publicRead, bucket: config.bucket, region: config.region };
}

function buildPublicUrl(config, key) {
  if (config.publicBaseUrl) {
    const base = config.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/${key}`;
  }
  if (config.endpoint) {
    // S3-compatible (Cloudflare R2, MinIO etc.)
    const base = config.endpoint.replace(/\/+$/, '');
    if (config.forcePathStyle) return `${base}/${config.bucket}/${key}`;
    return `${base}/${key}`;
  }
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

/**
 * Gera URL pública (não assinada). Usado quando o objeto foi salvo com publicRead.
 */
export async function getPublicUrl({ companyId, key }) {
  const { config } = await getClient(companyId);
  return buildPublicUrl(config, key);
}

/**
 * Gera URL temporária (presigned) para leitura. Default: 1h.
 */
export async function getPresignedUrl({ companyId, key, expiresIn = DEFAULT_PRESIGNED_EXPIRES_IN }) {
  const { client, config } = await getClient(companyId);
  const cmd = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return await getSignedUrl(client, cmd, { expiresIn });
}

/**
 * Baixa o objeto do bucket e devolve o conteúdo como Buffer.
 * Usa as credenciais armazenadas — funciona mesmo para objetos privados.
 * @returns {Promise<{ buffer: Buffer, contentType: string|undefined }>}
 */
export async function getObjectBuffer({ companyId, key }) {
  const { client, config } = await getClient(companyId);
  const res = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  const bytes = await res.Body.transformToByteArray();
  return { buffer: Buffer.from(bytes), contentType: res.ContentType };
}

/**
 * Remove o objeto do bucket.
 */
export async function deleteObject({ companyId, key }) {
  const { client, config } = await getClient(companyId);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

/**
 * Testa as credenciais e o bucket. Não persiste nada — apenas valida acesso.
 *
 * @param {object} params
 * @param {string} [params.companyId] — quando fornecido, usa a config da empresa
 * @param {object} [params.config]    — credenciais explícitas (para teste antes de salvar)
 */
export async function testConnection({ companyId, config }) {
  let cfg;
  if (config) {
    cfg = {
      bucket: config.bucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      endpoint: config.endpoint,
      forcePathStyle: !!config.forcePathStyle
    };
  } else {
    const resolved = await resolveConfig(companyId);
    if (!resolved) return { ok: false, message: 'Sem configuração disponível' };
    cfg = resolved.config;
  }
  if (!cfg.bucket || !cfg.region || !cfg.accessKeyId || !cfg.secretAccessKey) {
    return { ok: false, message: 'Campos obrigatórios faltando: bucket, region, accessKeyId, secretAccessKey' };
  }
  try {
    const client = buildClient(cfg);
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return { ok: true, message: `Conexão OK com bucket "${cfg.bucket}" em ${cfg.region}` };
  } catch (err) {
    return {
      ok: false,
      message: err?.name === 'NotFound'
        ? `Bucket "${cfg.bucket}" não encontrado em ${cfg.region}`
        : (err?.Code === 'AccessDenied' || err?.$metadata?.httpStatusCode === 403)
          ? 'Acesso negado: verifique as credenciais e a policy IAM'
          : `Falha de conexão: ${err?.message || err?.name || 'erro desconhecido'}`
    };
  }
}

/**
 * Indica se há configuração efetiva (empresa ou padrão).
 */
export async function hasConfig(companyId) {
  const r = await resolveConfig(companyId);
  return !!r;
}

// ─── Helpers para o controller ────────────────────────────────────────────────

export { encryptSecret, decryptSecret };

export default {
  uploadObject,
  getPublicUrl,
  getPresignedUrl,
  getObjectBuffer,
  deleteObject,
  testConnection,
  hasConfig,
  buildKey,
  sanitizeFilename,
  invalidateCompanyCache,
  invalidateAllCache
};
