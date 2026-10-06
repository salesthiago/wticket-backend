import mongoose from 'mongoose';
import Receivable from '../../models/financial/receivable.model.js';
import logger from '../../utils/logger.js';

class ReceivableRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    try {
      const doc = new Receivable(data);
      return await doc.save();
    } catch (error) {
      logger.error('ReceivableRepository :: create >> ', error);
      throw error;
    }
  }

  async findAll(companyId, {
    search,
    status,
    paymentMethod,
    customerId,
    serviceOrderId,
    projectId,
    dueFrom,
    dueTo,
    page = 0,
    limit = 20
  } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId, isActive: true };

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (customerId) query.customerId = customerId;
    if (serviceOrderId) query.serviceOrderId = serviceOrderId;
    if (projectId) query.projectId = projectId;
    if (dueFrom || dueTo) {
      query.dueDate = {};
      if (dueFrom) query.dueDate.$gte = new Date(dueFrom);
      if (dueTo) query.dueDate.$lte = new Date(dueTo);
    }
    if (search) {
      const rx = new RegExp(search, 'i');
      query.$or = [
        { number: rx },
        { description: rx },
        { notes: rx }
      ];
    }

    const [records, total] = await Promise.all([
      Receivable.find(query)
        .populate('customerId', 'name document phone email')
        .populate('serviceOrderId', 'orderNumber')
        .populate('projectId', 'projectNumber title')
        .populate('createdBy', 'name')
        .populate('paidBy', 'name')
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .exec(),
      Receivable.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await Receivable.findOne({ _id: id, companyId, isActive: true })
      .populate('customerId', 'name document phone email address')
      .populate('serviceOrderId', 'orderNumber status')
      .populate('projectId', 'projectNumber title')
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('cancelledBy', 'name email')
      .populate('statusHistory.changedBy', 'name');
  }

  async findActiveByServiceOrder(companyId, serviceOrderId) {
    if (!companyId) throw new Error('companyId is required');
    return await Receivable.find({
      companyId,
      serviceOrderId,
      isActive: true,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 });
  }

  async listByServiceOrder(companyId, serviceOrderId) {
    if (!companyId) throw new Error('companyId is required');
    return await Receivable.find({ companyId, serviceOrderId, isActive: true })
      .sort({ createdAt: -1 });
  }

  async findActiveByProject(companyId, projectId) {
    if (!companyId) throw new Error('companyId is required');
    return await Receivable.find({
      companyId,
      projectId,
      isActive: true,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 });
  }

  async listByProject(companyId, projectId) {
    if (!companyId) throw new Error('companyId is required');
    return await Receivable.find({ companyId, projectId, isActive: true })
      .sort({ createdAt: -1 });
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    delete patch.number;       // imutável
    delete patch.serviceOrderId; // imutável (vínculo de origem)
    delete patch.projectId;      // imutável (vínculo de origem)
    return await Receivable.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: patch },
      { new: true }
    )
      .populate('customerId', 'name document')
      .populate('serviceOrderId', 'orderNumber')
      .populate('projectId', 'projectNumber title');
  }

  async pushStatus(companyId, id, statusEntry) {
    if (!companyId) throw new Error('companyId is required');
    return await Receivable.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $push: { statusHistory: statusEntry } },
      { new: true }
    );
  }

  async softDelete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await Receivable.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: { isActive: false, deletedAt: new Date() } },
      { new: true }
    );
  }

  async aggregateByStatus(companyId, { dueFrom, dueTo } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const match = { companyId: new mongoose.Types.ObjectId(String(companyId)), isActive: true };
    if (dueFrom || dueTo) {
      match.dueDate = {};
      if (dueFrom) match.dueDate.$gte = new Date(dueFrom);
      if (dueTo) match.dueDate.$lte = new Date(dueTo);
    }
    return await Receivable.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
    ]);
  }
}

export default new ReceivableRepository();
