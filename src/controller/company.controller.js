import logger from '../utils/logger.js';
import companyRepository from '../repositories/company.repository.js';
import moduleRepository from '../repositories/module.repository.js';
import userRepository from '../repositories/user.repository.js';
import User from '../models/user.model.js';

const isSuperAdmin = (req) => req.user?.role === 'super_admin';
const isOwnCompany = (req) => req.user?.companyId && req.params.id === String(req.user.companyId);

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
    return res.json(company);
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
    return res.json(updated);
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
