import logger from '../../utils/logger.js';
import receivableService from '../../services/financial/receivable.service.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, status, paymentMethod, customerId, serviceOrderId, dueFrom, dueTo, page, limit } = req.query;
    const result = await receivableService.findAll(companyId, {
      search,
      status,
      paymentMethod,
      customerId,
      serviceOrderId,
      dueFrom,
      dueTo,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 20
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('ReceivableController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const doc = await receivableService.findById(companyId, id);
    if (!doc) return res.status(404).json({ message: 'Título não encontrado' });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ReceivableController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const doc = await receivableService.create({ companyId, userId, data: req.body || {} });
    return res.status(201).json(doc);
  } catch (err) {
    logger.error('ReceivableController :: create >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      details: err.details
    });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const doc = await receivableService.update({ companyId, id, data: req.body || {} });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ReceivableController :: update >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error'
    });
  }
};

export const registerPayment = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const { id } = req.params;
    const { paymentDate, paymentMethod, notes } = req.body || {};
    const doc = await receivableService.registerPayment({
      companyId, userId, id, paymentDate, paymentMethod, notes
    });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ReceivableController :: registerPayment >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error'
    });
  }
};

export const reversePayment = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const { id } = req.params;
    const { notes } = req.body || {};
    const doc = await receivableService.reversePayment({ companyId, userId, id, notes });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ReceivableController :: reversePayment >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error'
    });
  }
};

export const cancel = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const { id } = req.params;
    const { reason } = req.body || {};
    const doc = await receivableService.cancel({ companyId, userId, id, reason });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ReceivableController :: cancel >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error'
    });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const doc = await receivableService.destroy(companyId, id);
    if (!doc) return res.status(404).json({ message: 'Título não encontrado' });
    return res.status(200).json({ message: 'Título arquivado' });
  } catch (err) {
    logger.error('ReceivableController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const dashboard = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { dueFrom, dueTo } = req.query;
    const summary = await receivableService.dashboard(companyId, { dueFrom, dueTo });
    return res.status(200).json(summary);
  } catch (err) {
    logger.error('ReceivableController :: dashboard >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
