import logger from '../utils/logger.js';
import { diacriticSensitiveRegex, onlyNumbers } from '../utils/formatter.js';
import contactRepository from '../repositories/contact.repository.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search } = req.query;
    const page = (req?.page - 1) || 0;
    const rowsPerPage = req?.perPage || 10;

    const query = {};
    if (search) {
      query.name = { $regex: diacriticSensitiveRegex(search), $options: 'i' };
    }
    const contacts = await contactRepository.findAll({ query, page, rowsPerPage, companyId });

    return res.status(200).json(contacts);
  } catch (err) {
    logger.error('contact FindALL error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { name, email, phone, status, avatar } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'name and phone is required' });

    const exists = await contactRepository.findByNumber(onlyNumbers(phone), { companyId });
    if (exists) return res.status(422).json({ message: 'Invalid phone' });

    const contactCreate = await contactRepository.create({ ...req.body, companyId });

    return res.status(200).json(contactCreate);
  } catch (err) {
    logger.error('Error to create Contact >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const { name, email } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'email and name is required' });

    const contact = await contactRepository.findById(id, { companyId });
    if (!contact) return res.status(404).json({ message: 'the contact not founded!' });

    const updated = await contactRepository.update(id, req.body, { companyId });
    return res.json(updated);
  } catch (err) {
    logger.error('contact update error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const contact = await contactRepository.findById(id, { companyId });
    if (!contact) return res.status(404).json({ message: 'Contact not founded!' });

    return res.json(contact);
  } catch (err) {
    logger.error('contact findById error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    await contactRepository.destroy(companyId, id);
    
    return res.status(204).json({});
  } catch (err) {
    logger.error('contact findById error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
