

import logger from '../utils/logger.js';
import { diacriticSensitiveRegex, onlyNumbers } from '../utils/formatter.js';
import appointmentRepository from '../repositories/appointment.repository.js';

export const findAll = async (req, res) => {
  try {
    
    const { search } = req.query;
    const page = (req?.page - 1) || 0;
    const rowsPerPage = req?.perPage || 10;
    
    const query = {}
    if (search) {
        query.name = {
            $regex: diacriticSensitiveRegex(search),
            $options: "i",
        }
    }
    const contacts = await appointmentRepository.findAll({ query, page, rowsPerPage })

    return res.status(200).json(contacts);
  } catch (err) {
    logger.error('appointmentController FindALL error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, email, phone, status, avatar } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'name and phone is required' });

    const contact = await appointmentRepository.findByNumber(onlyNumbers(phone));
    if (contact) return res.status(422).json({ message: 'Invalid phone' });

    const contactCreate = await appointmentRepository.create(req.body);
    
    return res.status(200).json(contactCreate);
  } catch (err) {
    logger.error('Error to create appointmentController >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);  
    }
    const { name, email, phone, status, avatar } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'email and name is required' });

    const contact = await appointmentRepository.findById(id);
    if (!contact) return res.status(404).json({ message: 'the contact not founded!' });
    const updated = await appointmentRepository.update(id, req.body)
    return res.json(updated);
  } catch (err) {
    logger.error('appointmentController Update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

  export const findById = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }
    const contact = await appointmentRepository.findById(id);
    if (!contact) return res.status(404).json({ message: 'Contact not founded!' });

    return res.json(contact);
  } catch (err) {
    logger.error('appointmentController findById error >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
