import logger from '../utils/logger.js';
import customerRepository from '../repositories/customer.repository.js';

export const findAll = async (req, res) => {
  try {
    const { search, page, limit } = req.query;

    const result = await customerRepository.findAll({
      search,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 10
    });

    return res.status(200).json(result);
  } catch (err) {
    logger.error('CustomerController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await customerRepository.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.status(200).json(customer);
  } catch (err) {
    logger.error('CustomerController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, phone, email, documentType, document, address } = req.body;

    if (!name || !phone) {
      return res.status(422).json({ message: 'Fields name and phone are required' });
    }

    if (document) {
      const existing = await customerRepository.findByDocument(document);
      if (existing) {
        return res.status(409).json({ message: 'A customer with this document already exists' });
      }
    }

    const customer = await customerRepository.create({
      name,
      phone,
      email,
      documentType,
      document,
      address,
      source: 'manual'
    });

    return res.status(201).json(customer);
  } catch (err) {
    logger.error('CustomerController :: create >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (!body || Object.keys(body).length === 0) {
      return res.status(422).json({ message: 'Body is empty' });
    }

    const customer = await customerRepository.update(id, body);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.status(200).json(customer);
  } catch (err) {
    logger.error('CustomerController :: update >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await customerRepository.softDelete(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (err) {
    logger.error('CustomerController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
