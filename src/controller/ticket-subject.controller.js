import logger from '../utils/logger.js';
import ticketSubjectRepository from '../repositories/ticket-subject.repository.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { categoryId, active } = req.query;
    const subjects = await ticketSubjectRepository.findAll(categoryId || null, active === 'true', companyId);
    return res.status(200).json(subjects);
  } catch (err) {
    logger.error('ticketSubject findAll error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const subject = await ticketSubjectRepository.findById(id, companyId);
    if (!subject) return res.status(404).json({ message: 'Assunto não encontrado' });
    return res.status(200).json(subject);
  } catch (err) {
    logger.error('ticketSubject findById error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { name, description, categoryId, isActive } = req.body;
    if (!name) return res.status(422).json({ message: 'Nome é obrigatório' });
    const subject = await ticketSubjectRepository.create({ name, description, categoryId, isActive, companyId });
    return res.status(201).json(subject);
  } catch (err) {
    logger.error('ticketSubject create error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const updated = await ticketSubjectRepository.update(id, req.body, companyId);
    if (!updated) return res.status(404).json({ message: 'Assunto não encontrado' });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ticketSubject update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;
    const deleted = await ticketSubjectRepository.delete(id, companyId);
    if (!deleted) return res.status(404).json({ message: 'Assunto não encontrado' });
    return res.status(200).json({ message: 'Assunto removido com sucesso' });
  } catch (err) {
    logger.error('ticketSubject destroy error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
