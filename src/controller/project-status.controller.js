import logger from '../utils/logger.js';
import projectStatusRepository from '../repositories/project-status.repository.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { active } = req.query;
    const statuses = await projectStatusRepository.findAll(active === 'true', companyId);
    return res.status(200).json(statuses);
  } catch (err) {
    logger.error('projectStatus findAll error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const status = await projectStatusRepository.findById(id, companyId);
    if (!status) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json(status);
  } catch (err) {
    logger.error('projectStatus findById error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { name, label, color, isDefault, isClosingStatus, order, isActive } = req.body;
    if (!name || !label) return res.status(422).json({ message: 'Nome e label são obrigatórios' });
    const status = await projectStatusRepository.create({
      name, label, color, isDefault, isClosingStatus, order, isActive, companyId
    });
    return res.status(201).json(status);
  } catch (err) {
    logger.error('projectStatus create error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const updated = await projectStatusRepository.update(id, req.body, companyId);
    if (!updated) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('projectStatus update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const setDefault = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const updated = await projectStatusRepository.setDefault(id, companyId);
    if (!updated) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('projectStatus setDefault error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const deleted = await projectStatusRepository.delete(id, companyId);
    if (!deleted) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json({ message: 'Status removido com sucesso' });
  } catch (err) {
    logger.error('projectStatus destroy error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
