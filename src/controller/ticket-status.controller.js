import logger from '../utils/logger.js';
import ticketStatusRepository from '../repositories/ticket-status.repository.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { active } = req.query;
    const statuses = await ticketStatusRepository.findAll(active === 'true', companyId);
    return res.status(200).json(statuses);
  } catch (err) {
    logger.error('ticketStatus findAll error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const status = await ticketStatusRepository.findById(id, companyId);
    if (!status) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json(status);
  } catch (err) {
    logger.error('ticketStatus findById error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { name, label, color, isDefault, order, isActive } = req.body;
    if (!name || !label) return res.status(422).json({ message: 'Nome e label são obrigatórios' });
    const status = await ticketStatusRepository.create({ name, label, color, isDefault, order, isActive, companyId });
    return res.status(201).json(status);
  } catch (err) {
    logger.error('ticketStatus create error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const updated = await ticketStatusRepository.update(id, req.body, companyId);
    if (!updated) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ticketStatus update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const setDefault = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const updated = await ticketStatusRepository.setDefault(id, companyId);
    if (!updated) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ticketStatus setDefault error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const deleted = await ticketStatusRepository.delete(id, companyId);
    if (!deleted) return res.status(404).json({ message: 'Status não encontrado' });
    return res.status(200).json({ message: 'Status removido com sucesso' });
  } catch (err) {
    logger.error('ticketStatus destroy error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
