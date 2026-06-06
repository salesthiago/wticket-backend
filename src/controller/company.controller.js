import logger from '../utils/logger.js';
import companyRepository from '../repositories/company.repository.js';
import moduleRepository from '../repositories/module.repository.js';
import userRepository from '../repositories/user.repository.js';
import User from '../models/user.model.js';
import { encryptSecret } from '../utils/crypto.util.js';
import * as s3Service from '../services/storage/s3.service.js';

const isSuperAdmin = (req) => req.user?.role === 'super_admin';
const isOwnCompany = (req) => req.user?.companyId && req.params.id === String(req.user.companyId);

// Quem pode editar a config de storage da empresa:
//   super_admin (qualquer empresa) OU company_admin/administrator da própria empresa
function canManageStorage(req) {
  if (isSuperAdmin(req)) return true;
  if (!isOwnCompany(req)) return false;
  return req.user?.role === 'company_admin' || req.user?.role === 'administrator';
}

// Sanitiza a config antes de devolver à API (NUNCA expõe o secret)
function sanitizeStorageConfig(sc, source = 'company') {
  if (!sc) return { source: 'default', enabled: false, configured: false };
  return {
    source,
    enabled: !!sc.enabled,
    configured: !!(sc.bucket && sc.region && sc.accessKeyId && sc.secretAccessKeyEnc),
    bucket: sc.bucket,
    region: sc.region,
    accessKeyId: sc.accessKeyId,
    prefix: sc.prefix || '',
    publicBaseUrl: sc.publicBaseUrl || '',
    endpoint: sc.endpoint || '',
    forcePathStyle: !!sc.forcePathStyle,
    secretAccessKeyMasked: sc.secretAccessKeyEnc ? '••••••••' : null,
    testedAt: sc.testedAt || null,
    testOk: !!sc.testOk
  };
}

// A logo é guardada de forma PRIVADA no S3 (sem ACL pública). A permissão de
// leitura é concedida apenas no momento da requisição, gerando uma URL
// pré-assinada válida por 1 hora. Retorna um objeto simples (não-documento)
// com logo.url preenchida quando há storageKey.
async function attachLogoUrl(company) {
  if (!company) return company;
  const obj = typeof company.toObject === 'function' ? company.toObject() : { ...company };
  if (obj.logo?.storageKey) {
    try {
      obj.logo = {
        ...obj.logo,
        url: await s3Service.getPresignedUrl({
          companyId: String(obj._id),
          key: obj.logo.storageKey,
          expiresIn: 60 * 60 // 1 hora
        })
      };
    } catch (err) {
      logger.warn('Company :: falha ao gerar URL pré-assinada da logo', err?.message);
      obj.logo = { ...obj.logo, url: null };
    }
  }
  return obj;
}

export const findAll = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: 'Only super_admin can list companies' });
    }
    const { search, status } = req.query;
    const page = (Number(req.query.page) || 1) - 1;
    const rowsPerPage = Number(req.query.perPage) || 20;
    const query = {};
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };
    const companies = await companyRepository.findAll({ query, page, rowsPerPage });
    return res.status(200).json(companies);
  } catch (err) {
    logger.error('Company findAll error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    if (!isSuperAdmin(req) && !isOwnCompany(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { id } = req.params;
    const company = await companyRepository.findById(id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    return res.json(await attachLogoUrl(company));
  } catch (err) {
    logger.error('Company findById error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    if (!isSuperAdmin(req) && !isOwnCompany(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { id } = req.params;

    const allowed = ['name', 'document', 'documentType', 'email', 'phone', 'address'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (isSuperAdmin(req) && req.body.status !== undefined) data.status = req.body.status;

    const updated = await companyRepository.update(id, data);
    if (!updated) return res.status(404).json({ message: 'Company not found' });
    return res.json(await attachLogoUrl(updated));
  } catch (err) {
    logger.error('Company update error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const setStatus = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: 'Only super_admin can change company status' });
    }
    const { id } = req.params;
    const { status } = req.body;
    const updated = await companyRepository.setStatus(id, status);
    if (!updated) return res.status(404).json({ message: 'Company not found' });
    return res.json(updated);
  } catch (err) {
    logger.error('Company setStatus error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addModule = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: 'Only super_admin can attach modules' });
    }
    const { id } = req.params;
    const { code, subscriptionStatus = 'pending', activatedAt, expiresAt } = req.body;

    const mod = await moduleRepository.findByCode(code);
    if (!mod) return res.status(404).json({ message: 'Module not found' });

    const company = await companyRepository.findById(id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (company.modules.some(m => m.code === code)) {
      return res.status(422).json({ message: 'Module already attached' });
    }

    if (mod.requires?.length) {
      const missing = mod.requires.filter(req => !company.modules.some(m => m.code === req));
      if (missing.length) {
        return res.status(422).json({ message: `Missing required modules: ${missing.join(', ')}` });
      }
    }

    const updated = await companyRepository.addModule(id, {
      moduleId: mod._id,
      code: mod.code,
      subscriptionStatus,
      activatedAt,
      expiresAt
    });
    return res.json(updated);
  } catch (err) {
    logger.error('Company addModule error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const removeModule = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: 'Only super_admin can detach modules' });
    }
    const { id, code } = req.params;
    const updated = await companyRepository.removeModule(id, code);
    if (!updated) return res.status(404).json({ message: 'Company not found' });
    return res.json(updated);
  } catch (err) {
    logger.error('Company removeModule error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const setModuleSubscription = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: 'Only super_admin can change subscriptions' });
    }
    const { id, code } = req.params;
    const patch = {};
    ['subscriptionStatus', 'activatedAt', 'expiresAt'].forEach(k => {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    });
    const updated = await companyRepository.setModuleSubscription(id, code, patch);
    if (!updated) return res.status(404).json({ message: 'Company or module not found' });
    return res.json(updated);
  } catch (err) {
    logger.error('Company setModuleSubscription error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const register = async (req, res) => {
  try {
    const {
      company: companyData,
      owner: ownerData,
      modules: moduleCodes = []
    } = req.body;

    if (!companyData?.name || !companyData?.email) {
      return res.status(400).json({ message: 'company.name and company.email are required' });
    }
    if (!ownerData?.name || !ownerData?.email || !ownerData?.password) {
      return res.status(400).json({ message: 'owner.name, owner.email and owner.password are required' });
    }
    if (!Array.isArray(moduleCodes) || moduleCodes.length === 0) {
      return res.status(400).json({ message: 'modules must be a non-empty array of codes' });
    }

    const existingUser = await User.findOne({ email: ownerData.email });
    if (existingUser) return res.status(422).json({ message: 'Owner email already registered' });

    const existingCompanyEmail = await companyRepository.findByEmail(companyData.email);
    if (existingCompanyEmail) return res.status(422).json({ message: 'Company email already registered' });

    if (companyData.document) {
      const existingDoc = await companyRepository.findByDocument(companyData.document);
      if (existingDoc) return res.status(422).json({ message: 'Company document already registered' });
    }

    const modules = await moduleRepository.findByCodes(moduleCodes);
    if (modules.length !== moduleCodes.length) {
      return res.status(422).json({ message: 'One or more modules not found' });
    }
    for (const mod of modules) {
      if (mod.requires?.length) {
        const missing = mod.requires.filter(r => !moduleCodes.includes(r));
        if (missing.length) {
          return res.status(422).json({ message: `Module ${mod.code} requires: ${missing.join(', ')}` });
        }
      }
    }

    const company = await companyRepository.create({
      ...companyData,
      status: 'pending_payment',
      modules: modules.map(m => ({
        moduleId: m._id,
        code: m.code,
        subscriptionStatus: 'pending'
      }))
    });

    const owner = await userRepository.create({
      name: ownerData.name,
      email: ownerData.email,
      password: ownerData.password,
      role: 'company_admin',
      status: 'enabled',
      companyId: company._id
    });

    await companyRepository.update(company._id, { ownerId: owner._id });

    return res.status(201).json({
      company: { id: company._id, name: company.name, status: company.status },
      owner: { id: owner._id, name: owner.name, email: owner.email },
      modules: modules.map(m => m.code)
    });
  } catch (err) {
    logger.error('Company register error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Storage S3 ─────────────────────────────────────────────────────────────

export const getStorageConfig = async (req, res) => {
  try {
    if (!isSuperAdmin(req) && !isOwnCompany(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { id } = req.params;
    const company = await companyRepository.findById(id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const sc = company.storageConfig;
    const usingCompanyConfig = !!(sc?.enabled && sc?.bucket);
    const sanitized = sanitizeStorageConfig(sc, usingCompanyConfig ? 'company' : 'default');

    // Indica se há config padrão disponível no .env (sem expor credenciais)
    const hasDefaultEnv = !!(process.env.S3_DEFAULT_BUCKET && process.env.S3_DEFAULT_REGION
      && process.env.S3_DEFAULT_ACCESS_KEY && process.env.S3_DEFAULT_SECRET_KEY);

    return res.json({
      ...sanitized,
      defaultAvailable: hasDefaultEnv
    });
  } catch (err) {
    logger.error('Company getStorageConfig error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateStorageConfig = async (req, res) => {
  try {
    if (!canManageStorage(req)) {
      return res.status(403).json({ message: 'Apenas super_admin ou administrador da empresa' });
    }
    const { id } = req.params;
    const company = await companyRepository.findById(id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const body = req.body || {};
    const current = company.storageConfig || {};

    // Validação básica quando enabled = true
    const enabled = body.enabled === undefined ? !!current.enabled : !!body.enabled;
    if (enabled) {
      const bucket = body.bucket ?? current.bucket;
      const region = body.region ?? current.region;
      const accessKeyId = body.accessKeyId ?? current.accessKeyId;
      const willHaveSecret = !!body.secretAccessKey || !!current.secretAccessKeyEnc;
      if (!bucket || !region || !accessKeyId || !willHaveSecret) {
        return res.status(422).json({
          message: 'Para habilitar storage próprio, informe bucket, region, accessKeyId e secretAccessKey.'
        });
      }
    }

    // Constrói novo storageConfig (preserva campos não enviados)
    const next = {
      enabled,
      bucket: body.bucket ?? current.bucket,
      region: body.region ?? current.region,
      accessKeyId: body.accessKeyId ?? current.accessKeyId,
      secretAccessKeyEnc: body.secretAccessKey
        ? encryptSecret(body.secretAccessKey)
        : current.secretAccessKeyEnc,
      prefix: body.prefix ?? current.prefix ?? '',
      publicBaseUrl: body.publicBaseUrl ?? current.publicBaseUrl ?? '',
      endpoint: body.endpoint ?? current.endpoint ?? '',
      forcePathStyle: body.forcePathStyle ?? current.forcePathStyle ?? false,
      // testOk só é resetado quando credenciais mudam
      testedAt: current.testedAt,
      testOk: current.testOk
    };
    if (body.bucket || body.region || body.accessKeyId || body.secretAccessKey || body.endpoint) {
      next.testOk = false;
      next.testedAt = null;
    }

    const updated = await companyRepository.update(id, { storageConfig: next });
    s3Service.invalidateCompanyCache(id);
    return res.json(sanitizeStorageConfig(updated.storageConfig, enabled ? 'company' : 'default'));
  } catch (err) {
    logger.error('Company updateStorageConfig error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteStorageConfig = async (req, res) => {
  try {
    if (!canManageStorage(req)) {
      return res.status(403).json({ message: 'Apenas super_admin ou administrador da empresa' });
    }
    const { id } = req.params;
    const updated = await companyRepository.update(id, { storageConfig: null });
    if (!updated) return res.status(404).json({ message: 'Company not found' });
    s3Service.invalidateCompanyCache(id);
    return res.json({ message: 'Configuração removida. Voltando para o storage padrão.' });
  } catch (err) {
    logger.error('Company deleteStorageConfig error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const testStorageConnection = async (req, res) => {
  try {
    if (!canManageStorage(req)) {
      return res.status(403).json({ message: 'Apenas super_admin ou administrador da empresa' });
    }
    const { id } = req.params;
    const body = req.body || {};

    let result;
    if (body.bucket && body.region && body.accessKeyId && body.secretAccessKey) {
      // Testa credenciais fornecidas no payload (antes de salvar)
      result = await s3Service.testConnection({
        config: {
          bucket: body.bucket,
          region: body.region,
          accessKeyId: body.accessKeyId,
          secretAccessKey: body.secretAccessKey,
          endpoint: body.endpoint,
          forcePathStyle: !!body.forcePathStyle
        }
      });
    } else {
      // Usa config persistida da empresa (ou padrão se não houver)
      result = await s3Service.testConnection({ companyId: id });
    }

    // Se testou pela config persistida (sem payload), atualiza testOk
    if (!body.bucket) {
      const company = await companyRepository.findById(id);
      if (company?.storageConfig) {
        await companyRepository.update(id, {
          storageConfig: {
            ...company.storageConfig.toObject(),
            testedAt: new Date(),
            testOk: result.ok
          }
        });
      }
    }

    return res.status(result.ok ? 200 : 422).json(result);
  } catch (err) {
    logger.error('Company testStorageConnection error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Logo da Empresa ─────────────────────────────────────────────────────────

export const uploadLogo = async (req, res) => {
  try {
    // Mesma regra do storage: super_admin ou admin da própria empresa
    if (!canManageStorage(req)) {
      return res.status(403).json({ message: 'Apenas super_admin ou administrador da empresa' });
    }
    const { id } = req.params;
    if (!req.file) {
      return res.status(422).json({ message: 'Arquivo de logo é obrigatório (campo "logo")' });
    }

    const company = await companyRepository.findById(id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const ext = (req.file.originalname.match(/\.([A-Za-z0-9]+)$/)?.[1] || 'png').toLowerCase();
    const objectName = `logo-${Date.now()}.${ext}`;

    let logo;
    try {
      const result = await s3Service.uploadObject({
        companyId: id,
        category: 'company/logo',
        filename: objectName,
        body: req.file.buffer,
        contentType: req.file.mimetype
      });
      logo = {
        url: result.url,
        storageKey: result.key,
        storageBucket: result.bucket,
        storageSource: result.source
      };
    } catch (uploadErr) {
      logger.error('Company uploadLogo S3 error', uploadErr);
      return res.status(500).json({ message: uploadErr?.message || 'Falha ao enviar logo ao S3' });
    }

    // Remove a logo antiga do bucket (se existir e for do nosso storage)
    const oldKey = company.logo?.storageKey;
    if (oldKey && oldKey !== logo.storageKey) {
      try {
        await s3Service.deleteObject({ companyId: id, key: oldKey });
      } catch (delErr) {
        logger.warn('Company uploadLogo :: falha ao remover logo antiga', delErr?.message);
      }
    }

    const updated = await companyRepository.update(id, { logo });
    const withUrl = await attachLogoUrl(updated);
    return res.json({ logo: withUrl.logo });
  } catch (err) {
    logger.error('Company uploadLogo error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteLogo = async (req, res) => {
  try {
    if (!canManageStorage(req)) {
      return res.status(403).json({ message: 'Apenas super_admin ou administrador da empresa' });
    }
    const { id } = req.params;
    const company = await companyRepository.findById(id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const oldKey = company.logo?.storageKey;
    if (oldKey) {
      try {
        await s3Service.deleteObject({ companyId: id, key: oldKey });
      } catch (delErr) {
        logger.warn('Company deleteLogo :: falha ao remover do bucket', delErr?.message);
      }
    }

    await companyRepository.update(id, { logo: null });
    return res.json({ message: 'Logo removida' });
  } catch (err) {
    logger.error('Company deleteLogo error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
