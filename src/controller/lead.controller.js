import logger from '../utils/logger.js';
import leadRepository from '../repositories/lead.repository.js';
import serviceOrderRepository from '../repositories/service-order.repository.js';
import leadService from '../services/lead.service.js';

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
    const { name, phone, email, documentType, document, address, notes, description } = req.body;

    if (!name) return res.status(422).json({ message: 'Field name is required' });

    const lead = await leadRepository.create({
      companyId,
      name,
      phone,
      email,
      documentType,
      document,
      address,
      notes,
      description,
      source: 'manual'
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

    // Conversão só pelo fluxo próprio (convert / aprovação do orçamento).
    delete body.convertedTo;
    delete body.convertedAt;
    delete body.source;
    delete body.externalId;
    if (body.status === 'converted') delete body.status;

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

    const { customer, created } = await leadService.convertToCustomer(companyId, id);

    return res.status(created ? 201 : 200).json({
      customer,
      message: created
        ? 'Lead successfully converted to customer'
        : 'Lead linked to an existing customer with the same document/phone'
    });
  } catch (err) {
    logger.error('LeadController :: convertToCustomer >> ', err);
    return res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
  }
};

export const findServiceOrders = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const orders = await serviceOrderRepository.findByLead(companyId, id);
    return res.status(200).json(orders);
  } catch (err) {
    logger.error('LeadController :: findServiceOrders >> ', err);
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
