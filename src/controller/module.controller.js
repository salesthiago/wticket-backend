import logger from '../utils/logger.js';
import moduleRepository from '../repositories/module.repository.js';
import { MODULE_CODES } from '../models/module.model.js';

export const findAll = async (req, res) => {
  try {
    const { onlyActive } = req.query;
    const query = onlyActive === 'true' ? { isActive: true } : {};
    const modules = await moduleRepository.findAll({ query });
    return res.status(200).json(modules);
  } catch (err) {
    logger.error('Module findAll error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await moduleRepository.findById(id);
    if (!found) return res.status(404).json({ message: 'Module not found' });
    return res.json(found);
  } catch (err) {
    logger.error('Module findById error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super_admin can create modules' });
    }
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ message: 'code and name required' });
    if (!MODULE_CODES.includes(code)) {
      return res.status(422).json({ message: `code must be one of ${MODULE_CODES.join(', ')}` });
    }
    const exists = await moduleRepository.findByCode(code);
    if (exists) return res.status(422).json({ message: 'Module with this code already exists' });
    const created = await moduleRepository.create(req.body);
    return res.status(201).json(created);
  } catch (err) {
    logger.error('Module create error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super_admin can update modules' });
    }
    const { id } = req.params;
    const updated = await moduleRepository.update(id, req.body);
    if (!updated) return res.status(404).json({ message: 'Module not found' });
    return res.json(updated);
  } catch (err) {
    logger.error('Module update error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super_admin can delete modules' });
    }
    const { id } = req.params;
    await moduleRepository.destroy(id);
    return res.status(200).json({ message: 'Module deleted' });
  } catch (err) {
    logger.error('Module destroy error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
