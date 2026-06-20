import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import logger from '../../utils/logger.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.util.js';

const CERTS_BASE_DIR = path.resolve(process.cwd(), 'uploads', 'nfse-certs');

if (!fs.existsSync(CERTS_BASE_DIR)) {
  fs.mkdirSync(CERTS_BASE_DIR, { recursive: true });
}

// OID ICP-Brasil para CNPJ no SAN otherName de pessoa jurídica
const OID_CNPJ_ICP = '2.16.76.1.3.3';
// OID ICP-Brasil para CPF no SAN otherName de pessoa física
const OID_CPF_ICP = '2.16.76.1.3.1';

function extractCnpjFromSAN(cert) {
  // Procura extensão subjectAltName e busca otherName com OID ICP-Brasil
  const ext = cert.extensions?.find(e => e.name === 'subjectAltName');
  if (!ext || !ext.altNames) return null;

  for (const an of ext.altNames) {
    // node-forge expõe otherName em altNames com type 0
    if (an.type === 0 && an.value) {
      const raw = String(an.value);
      // CNPJ é uma sequência de 14 dígitos no conteúdo
      const m = raw.match(/(\d{14})/);
      if (m) return m[1];
    }
  }
  return null;
}

function getSubjectField(cert, shortName) {
  const a = cert.subject?.attributes?.find(x => x.shortName === shortName);
  return a ? a.value : null;
}

/**
 * Faz parse de um arquivo PFX/P12 e retorna metadados + PEMs.
 * @param {Buffer} pfxBuffer
 * @param {string} password
 * @returns {{ info: object, certPem: string, keyPem: string, caPems: string[] }}
 */
export function parsePfx(pfxBuffer, password) {
  const der = pfxBuffer.toString('binary');
  const p12Asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  // Cert bag (do titular)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = (certBags[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean);
  if (!certs.length) {
    throw new Error('Nenhum certificado encontrado no PFX');
  }

  // Chave privada (pkcs8ShroudedKeyBag ou keyBag)
  let keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  let keys = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || []).map(b => b.key);
  if (!keys.length) {
    keyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
    keys = (keyBags[forge.pki.oids.keyBag] || []).map(b => b.key);
  }
  if (!keys.length) {
    throw new Error('Chave privada não encontrada no PFX');
  }

  const cert = certs[0];
  const key = keys[0];

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(key);
  const caPems = certs.slice(1).map(c => forge.pki.certificateToPem(c));

  const cnpj = extractCnpjFromSAN(cert);

  const info = {
    subjectCN: getSubjectField(cert, 'CN'),
    subjectCNPJ: cnpj,
    issuer: cert.issuer?.attributes?.find(x => x.shortName === 'CN')?.value || null,
    notBefore: cert.validity?.notBefore || null,
    notAfter: cert.validity?.notAfter || null,
    serialNumber: cert.serialNumber || null
  };

  return { info, certPem, keyPem, caPems };
}

/**
 * Persiste o PFX em disco (com o conteúdo já cifrado pela própria senha do PFX
 * — não armazenamos PEM em claro). A senha é cifrada à parte.
 * @param {string} companyId
 * @param {Buffer} pfxBuffer
 * @param {string} originalName
 * @returns {{ filename: string, storagePath: string }}
 */
export function storePfxFile(companyId, pfxBuffer, originalName) {
  const dir = path.join(CERTS_BASE_DIR, String(companyId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safeName = (originalName || 'cert.pfx').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${Date.now()}-${safeName}`;
  const storagePath = path.join(dir, filename);

  fs.writeFileSync(storagePath, pfxBuffer);
  return { filename, storagePath };
}

/**
 * Carrega um certificado já configurado para uma empresa.
 * Retorna PEMs prontos para assinatura/uso.
 * @param {object} certificateRecord  trecho `certificate` do NfseConfig
 */
export function loadStoredCertificate(certificateRecord) {
  if (!certificateRecord || !certificateRecord.storagePath) {
    throw new Error('Certificado não configurado');
  }
  if (!fs.existsSync(certificateRecord.storagePath)) {
    throw new Error('Arquivo do certificado não encontrado em disco');
  }

  const password = decryptSecret(certificateRecord.passwordEnc);
  const pfxBuffer = fs.readFileSync(certificateRecord.storagePath);
  return parsePfx(pfxBuffer, password);
}

/**
 * Remove o arquivo PFX do disco. Idempotente.
 */
export function removePfxFile(storagePath) {
  try {
    if (storagePath && fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
  } catch (err) {
    logger.warn('NFSe certificate :: removePfxFile failed >> ', err);
  }
}

export const certificateService = {
  parsePfx,
  storePfxFile,
  loadStoredCertificate,
  removePfxFile,
  encryptSecret,
  decryptSecret
};

export default certificateService;
