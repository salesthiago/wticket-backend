import logger from '../utils/logger.js';
import leadRepository from '../repositories/lead.repository.js';
import customerRepository from '../repositories/customer.repository.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, status, page, limit } = req.query;

    const result = await leadRepository.findAll(companyId, {
      search,
      status,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 10
    });

    return res.status(200).json(result);
  } catch (err) {
    logger.error('LeadController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const lead = await leadRepository.findById(companyId, id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    return res.status(200).json(lead);
  } catch (err) {
    logger.error('LeadController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { name, phone, email, documentType, document, address, notes } = req.body;

    if (!name) return res.status(422).json({ message: 'Field name is required' });

    const lead = await leadRepository.create({
      companyId,
      name,
      phone,
      email,
      documentType,
      document,
      address,
      notes
    });

    return res.status(201).json(lead);
  } catch (err) {
    logger.error('LeadController :: create >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const body = req.body;

    if (!body || Object.keys(body).length === 0) {
      return res.status(422).json({ message: 'Body is empty' });
    }

    const lead = await leadRepository.update(companyId, id, body);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    return res.status(200).json(lead);
  } catch (err) {
    logger.error('LeadController :: update >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const convertToCustomer = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const lead = await leadRepository.findById(companyId, id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (lead.status === 'converted') {
      return res.status(409).json({ message: 'Lead already converted to customer' });
    }

    if (lead.document) {
      const existing = await customerRepository.findByDocument(companyId, lead.document);
      if (existing) {
        return res.status(409).json({ message: 'A customer with this document already exists' });
      }
    }

    const customer = await customerRepository.create({
      companyId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      documentType: lead.documentType,
      document: lead.document,
      address: lead.address,
      source: 'lead',
      leadId: lead._id
    });

    await leadRepository.convertToCustomer(companyId, id, customer._id);

    return res.status(201).json({ customer, message: 'Lead successfully converted to customer' });
  } catch (err) {
    logger.error('LeadController :: convertToCustomer >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const lead = await leadRepository.softDelete(companyId, id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    return res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (err) {
    logger.error('LeadController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
