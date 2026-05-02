import logger from '../utils/logger.js';
import serviceOrderRepository from '../repositories/service-order.repository.js';
import customerRepository from '../repositories/customer.repository.js';
import receivableService from '../services/financial/receivable.service.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, status, priority, technicianId, customerId, page, limit } = req.query;

    const result = await serviceOrderRepository.findAll(companyId, {
      search,
      status,
      priority,
      technicianId,
      customerId,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 10
    });

    return res.status(200).json(result);
  } catch (err) {
    logger.error('ServiceOrderController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const serviceOrder = await serviceOrderRepository.findById(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    return res.status(200).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findByOrderNumber = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { orderNumber } = req.params;

    const serviceOrder = await serviceOrderRepository.findByOrderNumber(companyId, orderNumber);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    return res.status(200).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: findByOrderNumber >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findByCustomer = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { customerId } = req.params;

    const orders = await serviceOrderRepository.findByCustomer(companyId, customerId);
    return res.status(200).json(orders);
  } catch (err) {
    logger.error('ServiceOrderController :: findByCustomer >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { customerId, equipment, reportedIssue, priority, technicianId, estimatedCompletionDate, internalNotes } = req.body;

    if (!customerId || !equipment?.type || !reportedIssue) {
      return res.status(422).json({
        message: 'Fields customerId, equipment.type and reportedIssue are required'
      });
    }

    const customer = await customerRepository.findById(companyId, customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const serviceOrder = await serviceOrderRepository.create({
      companyId,
      customerId,
      equipment,
      reportedIssue,
      priority,
      technicianId,
      estimatedCompletionDate,
      internalNotes,
      statusHistory: [{
        status: 'open',
        changedBy: req.user.sub,
        notes: 'Ordem de serviço criada'
      }]
    });

    return res.status(201).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: create >> ', err);
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

    delete body.status;
    delete body.statusHistory;
    delete body.orderNumber;

    const serviceOrder = await serviceOrderRepository.update(companyId, id, body);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    return res.status(200).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: update >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) return res.status(422).json({ message: 'Status is required' });

    const validStatuses = ['open', 'diagnosing', 'quoted', 'approved', 'in_progress', 'completed', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(422).json({ message: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    const serviceOrder = await serviceOrderRepository.findById(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    const updateData = { status };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      if (serviceOrder.warrantyDays > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + serviceOrder.warrantyDays);
        updateData.warrantyExpiresAt = expiresAt;
      }
    }

    if (status === 'cancelled') {
      updateData.cancelReason = notes || '';
    }

    await serviceOrderRepository.update(companyId, id, updateData);
    await serviceOrderRepository.addStatusHistory(companyId, id, {
      status,
      changedBy: req.user.sub,
      notes: notes || ''
    });

    const updated = await serviceOrderRepository.findById(companyId, id);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ServiceOrderController :: updateStatus >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addDiagnosis = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { diagnosis, services, parts, estimatedCost } = req.body;

    if (!diagnosis) return res.status(422).json({ message: 'Diagnosis is required' });

    const serviceOrder = await serviceOrderRepository.findById(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    const updateData = { diagnosis };
    if (services) updateData.services = services;
    if (parts) updateData.parts = parts;
    if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost;

    await serviceOrderRepository.update(companyId, id, updateData);

    const updated = await serviceOrderRepository.findById(companyId, id);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ServiceOrderController :: addDiagnosis >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const dashboard = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const statusCounts = await serviceOrderRepository.countByStatus(companyId);

    const summary = {
      open: 0,
      diagnosing: 0,
      quoted: 0,
      approved: 0,
      in_progress: 0,
      completed: 0,
      delivered: 0,
      cancelled: 0,
      total: 0
    };

    statusCounts.forEach(item => {
      summary[item._id] = item.count;
      summary.total += item.count;
    });

    return res.status(200).json(summary);
  } catch (err) {
    logger.error('ServiceOrderController :: dashboard >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Faturamento ──────────────────────────────────────────────────────────────

export const invoice = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const { id } = req.params;

    // Bloqueio de role aqui também (controller é alcançado via rotas de service-orders,
    // que não exigem role financeira). Permitimos administrator e finance.
    const role = req.user.role;
    if (!['super_admin', 'administrator', 'finance'].includes(role)) {
      return res.status(403).json({ message: 'Apenas usuários com role administrator ou finance podem faturar.' });
    }

    // Bloqueio de módulo: empresa precisa ter o módulo financial ativo
    const modules = req.user.modules || [];
    if (!modules.includes('financial')) {
      return res.status(403).json({ message: 'Módulo financeiro não está ativo para esta empresa.' });
    }

    const doc = await receivableService.invoiceFromServiceOrder({
      companyId,
      userId,
      serviceOrderId: id,
      data: req.body || {}
    });
    return res.status(201).json(doc);
  } catch (err) {
    logger.error('ServiceOrderController :: invoice >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      details: err.details
    });
  }
};

export const listReceivables = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const list = await receivableService.listByServiceOrder(companyId, id);
    return res.status(200).json(list);
  } catch (err) {
    logger.error('ServiceOrderController :: listReceivables >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const serviceOrder = await serviceOrderRepository.softDelete(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    return res.status(200).json({ message: 'Service order deleted successfully' });
  } catch (err) {
    logger.error('ServiceOrderController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
