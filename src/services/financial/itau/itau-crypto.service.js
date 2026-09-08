import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import logger from '../../../utils/logger.js';
import { encryptSecret, decryptSecret } from '../../../utils/crypto.util.js';

// Guarda os PEMs mTLS do Itaú (por empresa) CIFRADOS em disco. Espelha a
// abordagem de services/billing/payment-settings.service.js, mas num diretório
// próprio do módulo financeiro.

const CERTS_DIR = path.resolve(process.cwd(), 'uploads', 'financial-itau-certs');
if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });

export const PEM_CERT_RE = /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/;
export const PEM_KEY_RE = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/;

export function writeEncryptedPem(companyId, name, pem) {
  const safeName = String(name).replace(/[^a-z0-9._-]/gi, '_');
  const storagePath = path.join(CERTS_DIR, `${companyId}-${Date.now()}-${safeName}`);
  fs.writeFileSync(storagePath, encryptSecret(pem), 'utf8');
  return storagePath;
}

export function readEncryptedPem(storagePath) {
  if (!storagePath || !fs.existsSync(storagePath)) return undefined;
  try {
    return decryptSecret(fs.readFileSync(storagePath, 'utf8'));
  } catch (err) {
    logger.error('itau-crypto :: falha ao ler PEM cifrado >> ', err.message);
    return undefined;
  }
}

export function removeFileSafe(storagePath) {
  try {
    if (storagePath && fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
  } catch (err) {
    logger.warn(`itau-crypto :: removeFileSafe falhou: ${err.message}`);
  }
}

export function certMetaFromPem(pem) {
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

export function serializeCert(c) {
  if (!c) return { configured: false };
  return {
    configured: true,
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
