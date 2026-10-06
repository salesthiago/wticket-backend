import logger from '../../../utils/logger.js';
import { encryptSecret, decryptSecret } from '../../../utils/crypto.util.js';
import { ITAU_ENVIRONMENTS, ITAU_PIX_KEY_TYPES } from '../../../models/financial/itau/itau-config.model.js';
import itauConfigRepository from '../../../repositories/financial/itau/itau-config.repository.js';
import companyRepository from '../../../repositories/company.repository.js';
import {
  PEM_CERT_RE, PEM_KEY_RE,
  writeEncryptedPem, readEncryptedPem, removeFileSafe,
  certMetaFromPem, serializeCert
} from './itau-crypto.service.js';
import { getAccessToken, clearTokenCache } from './itau-api.client.js';

function httpError(message, status) {
  return Object.assign(new Error(message), { status: status || 422 });
}

function isMasked(v) {
  return typeof v === 'string' && /^[•*]{3,}/.test(v.trim());
}

function decryptMaybe(enc) {
  if (!enc) return undefined;
  try { return decryptSecret(enc); } catch { return undefined; }
}

// id_beneficiario Itaú: agência (4) + "000" + conta (7, com zeros à esq.) + DAC (1)
function buildBeneficiaryId({ agencia, conta, contaDAC }) {
  if (!agencia || !conta || !contaDAC) return undefined;
  const ag = String(agencia).replace(/\D/g, '').padStart(4, '0');
  const cc = String(conta).replace(/\D/g, '').padStart(7, '0');
  const dac = String(contaDAC).replace(/\D/g, '').slice(-1);
  return `${ag}000${cc}${dac}`;
}

class ItauConfigService {
  // View para o frontend — nunca devolve segredos.
  sanitize(config) {
    if (!config) return null;
    const o = config.toObject ? config.toObject() : { ...config };
    delete o.clientSecretEnc;
    delete o.webhookSecretEnc;
    if (o.privateKey) {
      o.privateKey = { configured: true, filename: o.privateKey.filename, uploadedAt: o.privateKey.uploadedAt };
    } else {
      o.privateKey = { configured: false };
    }
    o.certificate = serializeCert(config.certificate);
    o.clientSecretConfigured = !!config.clientSecretEnc;
    o.webhookSecretConfigured = !!config.webhookSecretEnc;
    o.complete = typeof config.isComplete === 'function' ? config.isComplete() : false;
    return o;
  }

  async get(companyId) {
    const config = await itauConfigRepository.findByCompany(companyId);
    return this.sanitize(config);
  }

  // { configured, active } — usado pelo frontend para decidir se mostra o botão
  // "Imprimir Fatura" em Contas a Receber.
  async status(companyId) {
    const config = await itauConfigRepository.findByCompany(companyId);
    return {
      configured: !!config && config.isComplete(),
      active: !!config && config.isActive && config.isComplete(),
      environment: config?.environment || null,
      testOk: config?.testOk || false,
      testedAt: config?.testedAt || null
    };
  }

  async upsert(companyId, body = {}) {
    const patch = {};

    if (body.environment !== undefined) {
      if (!ITAU_ENVIRONMENTS.includes(body.environment)) throw httpError('Ambiente inválido');
      patch.environment = body.environment;
    }
    if (body.clientId !== undefined) patch.clientId = String(body.clientId).trim() || undefined;
    if (body.clientSecret && !isMasked(body.clientSecret)) {
      patch.clientSecretEnc = encryptSecret(String(body.clientSecret).trim());
    }
    if (body.webhookSecret && !isMasked(body.webhookSecret)) {
      patch.webhookSecretEnc = encryptSecret(String(body.webhookSecret).trim());
    }

    for (const f of ['agencia', 'conta', 'contaDAC', 'carteira', 'nomeCobranca', 'documento', 'instrucoes', 'mensagemPix']) {
      if (body[f] !== undefined) patch[f] = body[f] == null ? undefined : String(body[f]).trim();
    }
    if (body.pixKey !== undefined) patch.pixKey = String(body.pixKey || '').trim() || undefined;
    if (body.pixKeyType !== undefined) {
      if (body.pixKeyType && !ITAU_PIX_KEY_TYPES.includes(body.pixKeyType)) throw httpError('Tipo de chave PIX inválido');
      patch.pixKeyType = body.pixKeyType || undefined;
    }
    for (const f of ['jurosPercent', 'multaPercent', 'diasBaixaAutomatica']) {
      if (body[f] !== undefined) patch[f] = Number(body[f]) || 0;
    }
    if (body.endereco !== undefined && typeof body.endereco === 'object') {
      patch.endereco = body.endereco;
    }
    if (body.isActive !== undefined) patch.isActive = !!body.isActive;

    // Recalcula o id_beneficiario quando os dados bancários mudam.
    const merged = { ...(await itauConfigRepository.findByCompany(companyId))?.toObject?.() || {}, ...patch };
    const benId = buildBeneficiaryId(merged);
    if (benId) patch.beneficiaryId = benId;

    // Pré-preenche beneficiário com dados da empresa quando ainda vazio.
    if (patch.nomeCobranca === undefined && !merged.nomeCobranca) {
      const company = await companyRepository.findById(companyId);
      if (company) {
        patch.nomeCobranca = company.name;
        patch.documento = company.document || undefined;
        if (company.address) {
          patch.endereco = {
            logradouro: company.address.street,
            numero: company.address.number,
            complemento: company.address.complement,
            bairro: company.address.neighborhood,
            cidade: company.address.city,
            uf: company.address.state,
            cep: company.address.zipCode
          };
        }
      }
    }

    // Não deixa ativar sem configuração completa.
    if (patch.isActive) {
      const probe = { ...merged, ...patch };
      const complete = probe.clientId && probe.clientSecretEnc &&
        probe.certificate?.storagePath && probe.privateKey?.storagePath &&
        probe.agencia && probe.conta && probe.carteira && probe.pixKey;
      if (!complete) {
        throw httpError('Não é possível ativar: a configuração Itaú está incompleta (credenciais, certificado, chave, conta e chave PIX são obrigatórios).');
      }
    }

    const saved = await itauConfigRepository.upsert(companyId, patch);
    if (patch.clientId !== undefined || patch.clientSecretEnc || patch.environment) {
      clearTokenCache({ companyId, clientId: saved.clientId, environment: saved.environment });
    }
    return this.sanitize(saved);
  }

  async uploadCertificate(companyId, file) {
    if (!file?.buffer?.length) throw httpError('Arquivo do certificado (.crt/.pem) é obrigatório');
    const pem = file.buffer.toString('utf8');
    if (!PEM_CERT_RE.test(pem)) throw httpError('O arquivo não parece ser um certificado PEM válido.');

    let meta;
    try { meta = certMetaFromPem(pem); }
    catch (err) {
      logger.warn('itau-config :: parse cert falhou >> ', err.message);
      throw httpError('Falha ao ler o certificado. Verifique o arquivo.');
    }
    if (meta.notAfter && new Date(meta.notAfter) < new Date()) throw httpError('Certificado vencido');

    const current = await itauConfigRepository.findByCompany(companyId);
    if (current?.certificate?.storagePath) removeFileSafe(current.certificate.storagePath);

    const storagePath = writeEncryptedPem(companyId, 'itau.crt', pem.trim() + '\n');
    const saved = await itauConfigRepository.setCertificate(companyId, {
      filename: file.originalname || 'itau.crt',
      storagePath,
      ...meta,
      uploadedAt: new Date()
    });
    clearTokenCache({ companyId, clientId: saved.clientId, environment: saved.environment });
    return this.sanitize(saved);
  }

  async uploadPrivateKey(companyId, file) {
    if (!file?.buffer?.length) throw httpError('Arquivo da chave privada (.key) é obrigatório');
    const pem = file.buffer.toString('utf8');
    if (!PEM_KEY_RE.test(pem)) throw httpError('O arquivo não parece ser uma chave privada PEM válida.');

    const current = await itauConfigRepository.findByCompany(companyId);
    if (current?.privateKey?.storagePath) removeFileSafe(current.privateKey.storagePath);

    const storagePath = writeEncryptedPem(companyId, 'itau.key', pem.trim() + '\n');
    const saved = await itauConfigRepository.setPrivateKey(companyId, {
      filename: file.originalname || 'itau.key',
      storagePath,
      uploadedAt: new Date()
    });
    clearTokenCache({ companyId, clientId: saved.clientId, environment: saved.environment });
    return this.sanitize(saved);
  }

  async removeCertificate(companyId) {
    const current = await itauConfigRepository.findByCompany(companyId);
    if (current?.certificate?.storagePath) removeFileSafe(current.certificate.storagePath);
    const saved = await itauConfigRepository.clearCertificate(companyId);
    if (saved?.isActive) await itauConfigRepository.upsert(companyId, { isActive: false });
    return this.sanitize(await itauConfigRepository.findByCompany(companyId));
  }

  async removePrivateKey(companyId) {
    const current = await itauConfigRepository.findByCompany(companyId);
    if (current?.privateKey?.storagePath) removeFileSafe(current.privateKey.storagePath);
    const saved = await itauConfigRepository.clearPrivateKey(companyId);
    if (saved?.isActive) await itauConfigRepository.upsert(companyId, { isActive: false });
    return this.sanitize(await itauConfigRepository.findByCompany(companyId));
  }

  // Config EFETIVA já descriptografada — consumida pelo itau-boleto.service.
  async getEffectiveConfig(companyId) {
    const c = await itauConfigRepository.findByCompany(companyId);
    if (!c) throw httpError('Integração Itaú não configurada para esta empresa.');
    return {
      companyId: String(companyId),
      raw: c,
      environment: c.environment,
      clientId: c.clientId,
      clientSecret: decryptMaybe(c.clientSecretEnc),
      webhookSecret: decryptMaybe(c.webhookSecretEnc),
      certificatePem: readEncryptedPem(c.certificate?.storagePath),
      privateKeyPem: readEncryptedPem(c.privateKey?.storagePath),
      agencia: c.agencia,
      conta: c.conta,
      contaDAC: c.contaDAC,
      carteira: c.carteira,
      beneficiaryId: c.beneficiaryId,
      pixKey: c.pixKey,
      pixKeyType: c.pixKeyType,
      mensagemPix: c.mensagemPix,
      nomeCobranca: c.nomeCobranca,
      documento: c.documento,
      endereco: c.endereco,
      jurosPercent: c.jurosPercent,
      multaPercent: c.multaPercent,
      diasBaixaAutomatica: c.diasBaixaAutomatica,
      instrucoes: c.instrucoes,
      isActive: c.isActive
    };
  }

  async testConnection(companyId) {
    const cfg = await this.getEffectiveConfig(companyId);
    if (!cfg.clientId || !cfg.clientSecret) throw httpError('Informe o Client ID e o Client Secret antes de testar.');
    if (!cfg.certificatePem || !cfg.privateKeyPem) throw httpError('Envie o certificado e a chave mTLS antes de testar.');
    try {
      await getAccessToken(cfg, { force: true });
      await itauConfigRepository.setTestResult(companyId, true);
      return { ok: true, message: 'Autenticação OAuth2 com o Itaú bem-sucedida.' };
    } catch (err) {
      await itauConfigRepository.setTestResult(companyId, false);
      throw httpError(err.message || 'Falha na autenticação com o Itaú.', err.status || 502);
    }
  }
}

export default new ItauConfigService();
export { buildBeneficiaryId };
