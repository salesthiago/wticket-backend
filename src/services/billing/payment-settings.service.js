import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import logger from '../../utils/logger.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.util.js';
import paymentSettingsRepository from '../../repositories/billing/payment-settings.repository.js';
import { getItauEnvConfig, getStripeEnvConfig } from '../../config/payment.js';
import registry from './providers/index.js';

const CERTS_DIR = path.resolve(process.cwd(), 'uploads', 'itau-certs');
if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });

const PEM_CERT_RE = /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/;
const PEM_KEY_RE = /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC )?PRIVATE KEY-----/;

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Escreve o PEM CIFRADO em disco e devolve o caminho.
function writeEncryptedPem(name, pem) {
  const storagePath = path.join(CERTS_DIR, `${Date.now()}-${name}`);
  fs.writeFileSync(storagePath, encryptSecret(pem), 'utf8');
  return storagePath;
}

function readEncryptedPem(storagePath) {
  if (!storagePath || !fs.existsSync(storagePath)) return undefined;
  try {
    return decryptSecret(fs.readFileSync(storagePath, 'utf8'));
  } catch (err) {
    logger.error('payment-settings :: falha ao ler PEM cifrado >> ', err.message);
    return undefined;
  }
}

function removeFileSafe(storagePath) {
  try {
    if (storagePath && fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
  } catch (err) {
    logger.warn(`payment-settings :: removeFileSafe falhou: ${err.message}`);
  }
}

function certMetaFromPem(pem) {
  const cert = forge.pki.certificateFromPem(pem);
  const cn = cert.subject.getField('CN');
  const issuerCn = cert.issuer.getField('CN');
  return {
    subjectCN: cn ? cn.value : null,
    issuer: issuerCn ? issuerCn.value : null,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
    serialNumber: cert.serialNumber || null
  };
}

class PaymentSettingsService {
  // ─── Visão admin (segredos redigidos) ─────────────────────────────────────

  async getForAdmin() {
    const doc = await paymentSettingsRepository.getOrCreate();
    return {
      methods: doc.methods.map(m => ({
        method: m.method,
        enabled: m.enabled,
        providerKey: m.providerKey
      })),
      abacatepay: {
        enabled: doc.abacatepay.enabled,
        configured: registry.get('abacatepay').isConfigured()
      },
      itau: {
        enabled: doc.itau.enabled,
        environment: doc.itau.environment,
        clientId: doc.itau.clientId || null,
        beneficiaryId: doc.itau.beneficiaryId || null,
        recurringEnabled: doc.itau.recurringEnabled,
        clientSecretConfigured: !!doc.itau.clientSecretEnc,
        webhookSecretConfigured: !!doc.itau.webhookSecretEnc,
        certificate: doc.itau.certificate
          ? { ...serializeCert(doc.itau.certificate), configured: true }
          : { configured: false },
        privateKey: doc.itau.privateKey
          ? { filename: doc.itau.privateKey.filename, uploadedAt: doc.itau.privateKey.uploadedAt, configured: true }
          : { configured: false }
      },
      stripe: {
        enabled: doc.stripe.enabled,
        environment: doc.stripe.environment,
        publishableKey: doc.stripe.publishableKey || null,
        secretKeyConfigured: !!doc.stripe.secretKeyEnc,
        webhookSecretConfigured: !!doc.stripe.webhookSecretEnc
      },
      providers: registry.list().map(p => ({
        key: p.key,
        supportedMethods: p.supportedMethods,
        supportsRecurring: p.supportsRecurring
      })),
      updatedAt: doc.updatedAt
    };
  }

  // ─── Update (patch + cifra segredos) ──────────────────────────────────────

  async save({ methods, abacatepay, itau, stripe } = {}, userId) {
    if (methods) {
      for (const route of methods) {
        if (!registry.has(route.providerKey)) {
          throw httpError(`Provedor desconhecido: ${route.providerKey}`, 422);
        }
        const provider = registry.get(route.providerKey);
        if (route.enabled && !provider.supportedMethods.includes(route.method)) {
          throw httpError(`O provedor ${route.providerKey} não processa o método ${route.method}.`, 422);
        }
      }
      const byMethod = new Map();
      for (const r of methods) {
        byMethod.set(r.method, {
          method: r.method,
          enabled: !!r.enabled,
          providerKey: r.providerKey
        });
      }
      await paymentSettingsRepository.setMethods([...byMethod.values()]);
    }

    if (abacatepay && abacatepay.enabled !== undefined) {
      await paymentSettingsRepository.patchProvider('abacatepay', { enabled: !!abacatepay.enabled }, userId);
    }

    if (itau) {
      const patch = {};
      if (itau.enabled !== undefined) patch.enabled = !!itau.enabled;
      if (itau.environment !== undefined) {
        patch.environment = itau.environment === 'sandbox' ? 'sandbox' : 'production';
      }
      if (itau.clientId !== undefined) patch.clientId = String(itau.clientId).trim() || undefined;
      if (itau.beneficiaryId !== undefined) patch.beneficiaryId = String(itau.beneficiaryId).trim() || undefined;
      if (itau.recurringEnabled !== undefined) patch.recurringEnabled = !!itau.recurringEnabled;
      if (itau.clientSecret && !isMasked(itau.clientSecret)) {
        patch.clientSecretEnc = encryptSecret(String(itau.clientSecret).trim());
      }
      if (itau.webhookSecret && !isMasked(itau.webhookSecret)) {
        patch.webhookSecretEnc = encryptSecret(String(itau.webhookSecret).trim());
      }
      await paymentSettingsRepository.patchProvider('itau', patch, userId);
    }

    if (stripe) {
      const patch = {};
      if (stripe.enabled !== undefined) patch.enabled = !!stripe.enabled;
      if (stripe.environment !== undefined) {
        patch.environment = stripe.environment === 'live' ? 'live' : 'test';
      }
      if (stripe.publishableKey !== undefined) {
        patch.publishableKey = String(stripe.publishableKey).trim() || undefined;
      }
      if (stripe.secretKey && !isMasked(stripe.secretKey)) {
        patch.secretKeyEnc = encryptSecret(String(stripe.secretKey).trim());
      }
      if (stripe.webhookSecret && !isMasked(stripe.webhookSecret)) {
        patch.webhookSecretEnc = encryptSecret(String(stripe.webhookSecret).trim());
      }
      await paymentSettingsRepository.patchProvider('stripe', patch, userId);
    }

    return this.getForAdmin();
  }

  // ─── Upload de certificado / chave mTLS do Itaú (.crt / .key PEM) ──────────

  async uploadItauCertificate(file) {
    if (!file?.buffer?.length) throw httpError('Arquivo do certificado (.crt) é obrigatório', 422);
    const pem = file.buffer.toString('utf8');
    if (!PEM_CERT_RE.test(pem)) {
      throw httpError('O arquivo não parece ser um certificado PEM (.crt) válido.', 422);
    }

    let meta;
    try {
      meta = certMetaFromPem(pem);
    } catch (err) {
      logger.warn('payment-settings :: parse cert falhou >> ', err.message);
      throw httpError('Falha ao ler o certificado. Verifique o arquivo.', 422);
    }
    if (meta.notAfter && new Date(meta.notAfter) < new Date()) {
      throw httpError('Certificado vencido', 422);
    }

    const doc = await paymentSettingsRepository.getOrCreate();
    if (doc.itau.certificate?.storagePath) removeFileSafe(doc.itau.certificate.storagePath);

    const storagePath = writeEncryptedPem('itau.crt', pem.trim() + '\n');
    const saved = await paymentSettingsRepository.setItauCertificate({
      filename: file.originalname || 'itau.crt',
      storagePath,
      ...meta,
      uploadedAt: new Date()
    });
    return this._sanitizeDoc(saved);
  }

  async uploadItauPrivateKey(file) {
    if (!file?.buffer?.length) throw httpError('Arquivo da chave privada (.key) é obrigatório', 422);
    const pem = file.buffer.toString('utf8');
    if (!PEM_KEY_RE.test(pem)) {
      throw httpError('O arquivo não parece ser uma chave privada PEM (.key) válida.', 422);
    }

    const doc = await paymentSettingsRepository.getOrCreate();
    if (doc.itau.privateKey?.storagePath) removeFileSafe(doc.itau.privateKey.storagePath);

    const storagePath = writeEncryptedPem('itau.key', pem.trim() + '\n');
    const saved = await paymentSettingsRepository.setItauPrivateKey({
      filename: file.originalname || 'itau.key',
      storagePath,
      uploadedAt: new Date()
    });
    return this._sanitizeDoc(saved);
  }

  _sanitizeDoc() {
    return this.getForAdmin();
  }

  // ─── Config efetiva por provedor (painel > .env), já descriptografada ─────

  async getItauConfig() {
    const doc = await paymentSettingsRepository.getOrCreate();
    const i = doc.itau;
    const env = getItauEnvConfig();
    return {
      environment: i.environment || env.environment,
      clientId: i.clientId || env.clientId,
      clientSecret: decryptMaybe(i.clientSecretEnc) || env.clientSecret,
      webhookSecret: decryptMaybe(i.webhookSecretEnc) || env.webhookSecret,
      certificatePem: readEncryptedPem(i.certificate?.storagePath) || env.certificatePem,
      privateKeyPem: readEncryptedPem(i.privateKey?.storagePath) || env.privateKeyPem,
      beneficiaryId: i.beneficiaryId || undefined,
      recurringEnabled: !!i.recurringEnabled
    };
  }

  async getStripeConfig() {
    const doc = await paymentSettingsRepository.getOrCreate();
    const s = doc.stripe;
    const env = getStripeEnvConfig();
    return {
      environment: s.environment || 'test',
      publishableKey: s.publishableKey || undefined,
      secretKey: decryptMaybe(s.secretKeyEnc) || env.secretKey,
      webhookSecret: decryptMaybe(s.webhookSecretEnc) || env.webhookSecret
    };
  }

  async getConfigFor(providerKey) {
    if (providerKey === 'itau') return this.getItauConfig();
    if (providerKey === 'stripe') return this.getStripeConfig();
    return {};
  }

  /**
   * Resolve o provedor responsável por um método habilitado.
   * @returns {{ providerKey, config, recurring }}
   */
  async resolveForMethod(method) {
    const doc = await paymentSettingsRepository.getOrCreate();
    const route = doc.methods.find(m => m.method === method);
    if (!route || !route.enabled) {
      throw httpError(`Método de pagamento "${method}" não está habilitado.`, 422);
    }
    const provider = registry.get(route.providerKey);
    const config = await this.getConfigFor(route.providerKey);
    if (route.providerKey !== 'abacatepay' && !provider.isConfigured(config)) {
      throw httpError(
        `O provedor ${route.providerKey} está selecionado para ${method}, mas não está configurado.`,
        422
      );
    }
    const recurring =
      route.providerKey === 'itau' && doc.itau.recurringEnabled && method === 'pix';
    return { providerKey: route.providerKey, config, recurring };
  }

  /**
   * Roteamento padrão quando nenhum método é informado no checkout.
   * Preferência: cartão via provedor mapeado. Fallback duro: AbacatePay
   * (preserva o comportamento atual mesmo se a config estiver incompleta).
   */
  async defaultRoute() {
    const doc = await paymentSettingsRepository.getOrCreate();
    const card =
      doc.methods.find(m => m.method === 'credit_card' && m.enabled) ||
      doc.methods.find(m => m.enabled && registry.get(m.providerKey).supportedMethods.includes('credit_card'));
    if (card) {
      try {
        return await this.resolveForMethod(card.method);
      } catch (_) { /* cai no fallback abaixo */ }
    }
    return { providerKey: 'abacatepay', config: {}, recurring: false };
  }
}

function isMasked(v) {
  return typeof v === 'string' && /^[•*]{3,}/.test(v.trim());
}

function decryptMaybe(enc) {
  if (!enc) return undefined;
  try {
    return decryptSecret(enc);
  } catch {
    return undefined;
  }
}

function serializeCert(c) {
  return {
    filename: c.filename,
    subjectCN: c.subjectCN,
    issuer: c.issuer,
    notBefore: c.notBefore,
    notAfter: c.notAfter,
    serialNumber: c.serialNumber,
    uploadedAt: c.uploadedAt,
    expired: c.notAfter ? new Date(c.notAfter) < new Date() : false,
    daysToExpire: c.notAfter
      ? Math.ceil((new Date(c.notAfter).getTime() - Date.now()) / 86400000)
      : null
  };
}

export default new PaymentSettingsService();
