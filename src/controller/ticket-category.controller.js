import logger from '../utils/logger.js';
import ticketCategoryRepository from '../repositories/ticket-category.repository.js';

export const findAll = async (req, res) => {
  try {
    const { active } = req.query;
    const categories = await ticketCategoryRepository.findAll(active === 'true');
    return res.status(200).json(categories);
  } catch (err) {
    logger.error('ticketCategory findAll error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await ticketCategoryRepository.findById(id);
    if (!category) return res.status(404).json({ message: 'Categoria não encontrada' });
    return res.status(200).json(category);
  } catch (err) {
    logger.error('ticketCategory findById error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, description, color, isActive } = req.body;
    if (!name) return res.status(422).json({ message: 'Nome é obrigatório' });
    const category = await ticketCategoryRepository.create({ name, description, color, isActive });
    return res.status(201).json(category);
  } catch (err) {
    logger.error('ticketCategory create error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await ticketCategoryRepository.update(id, req.body);
    if (!updated) return res.status(404).json({ message: 'Categoria não encontrada' });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ticketCategory update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ticketCategoryRepository.delete(id);
    if (!deleted) return res.status(404).json({ message: 'Categoria não encontrada' });
    return res.status(200).json({ message: 'Categoria removida com sucesso' });
  } catch (err) {
    logger.error('ticketCategory destroy error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
