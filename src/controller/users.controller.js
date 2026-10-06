
import User from '../models/user.model.js';
import logger from '../utils/logger.js';
import { diacriticSensitiveRegex } from '../utils/formatter.js';
import userRepository from '../repositories/user.repository.js';

const isSuperAdmin = (req) => req.user?.role === 'super_admin';

export const findAll = async (req, res) => {
  try {
    const { search, page, limit, internalOnly } = req.query;
    const rowsPerPage = limit ? parseInt(limit) : 10;

    const query = {};
    if (search) {
      query.name = {
        $regex: diacriticSensitiveRegex(search),
        $options: "i",
      };
    }
    // Usuários "internos" (sem customerId): equipe da empresa, elegível para
    // ser designada como responsável por uma tarefa/ticket.
    if (internalOnly === 'true') {
      query.customerId = null;
    }

    // super_admin sees all users; everyone else only their company
    const companyId = isSuperAdmin(req) ? undefined : req.user.companyId;
    if (!isSuperAdmin(req) && !companyId) {
      return res.status(403).json({ message: 'Tenant access required' });
    }

    const users = await userRepository.findAll({
      query,
      page: page ? parseInt(page) - 1 : 0,
      rowsPerPage,
      companyId
    });

    return res.status(200).json(users);
  } catch (err) {
    logger.error('FindAll error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, email, password, status, role, customerId } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(422).json({ message: 'Invalid Email!' });

    // Force user to be created within the requester's company (unless super_admin)
    const companyId = isSuperAdmin(req)
      ? (req.body.companyId || null)
      : req.user.companyId;

    if (!isSuperAdmin(req) && !companyId) {
      return res.status(403).json({ message: 'Tenant access required' });
    }

    // Block non-super-admins from creating super_admin or company_admin via this route
    let safeRole = role || 'default';
    if (!isSuperAdmin(req)) {
      if (safeRole === 'super_admin') {
        return res.status(403).json({ message: 'Cannot create super_admin' });
      }
      if (safeRole === 'company_admin' && req.user.role !== 'company_admin') {
        return res.status(403).json({ message: 'Only company_admin can create another company_admin' });
      }
    }

    const userCreated = await userRepository.create({
      name,
      email,
      password,
      status,
      role: safeRole,
      companyId,
      customerId: customerId || null
    });
    return res.status(200).json(userCreated);
  } catch (err) {
    logger.error('Create user error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const { name, email } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'email and name is required' });

    const companyId = isSuperAdmin(req) ? undefined : req.user.companyId;
    if (!isSuperAdmin(req) && !companyId) {
      return res.status(403).json({ message: 'Tenant access required' });
    }

    const user = await userRepository.findById(id, { companyId });
    if (!user) return res.status(404).json({ message: 'User not founded!' });

    // Non-super-admins cannot escalate role
    const patch = { ...req.body };
    if (!isSuperAdmin(req)) {
      delete patch.role;
      delete patch.companyId;
    }

    const updated = await userRepository.update(id, patch, { companyId });
    return res.json(updated);
  } catch (err) {
    logger.error('update User error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const companyId = isSuperAdmin(req) ? undefined : req.user.companyId;
    if (!isSuperAdmin(req) && !companyId) {
      return res.status(403).json({ message: 'Tenant access required' });
    }

    const user = await userRepository.findById(id, { companyId });
    if (!user) return res.status(404).json({ message: 'User not founded!' });

    return res.json(user);
  } catch (err) {
    logger.error('findById User error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const companyId = isSuperAdmin(req) ? undefined : req.user.companyId;
    if (!isSuperAdmin(req) && !companyId) {
      return res.status(403).json({ message: 'Tenant access required' });
    }

    const deleted = await userRepository.destroy(id, { companyId });
    if (!deleted) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ message: 'Deleted with successfully' });
  } catch (err) {
    logger.error('destroy User error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
