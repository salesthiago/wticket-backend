import mongoose from 'mongoose';
import ServiceOrder from '../models/service-order.model.js';
import logger from '../utils/logger.js';

class ServiceOrderRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    try {
      const serviceOrder = new ServiceOrder(data);
      return await serviceOrder.save();
    } catch (error) {
      logger.error('ServiceOrderRepository :: create >> ', error);
      throw error;
    }
  }

  async findAll(companyId, { search, status, priority, technicianId, customerId, page = 0, limit = 10 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    try {
      const query = { companyId, isActive: true };

      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (technicianId) query.technicianId = technicianId;
      if (customerId) query.customerId = customerId;

      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { reportedIssue: { $regex: search, $options: 'i' } },
          { diagnosis: { $regex: search, $options: 'i' } },
          { 'equipment.type': { $regex: search, $options: 'i' } },
          { 'equipment.brand': { $regex: search, $options: 'i' } },
          { 'equipment.model': { $regex: search, $options: 'i' } },
          { 'equipment.serialNumber': { $regex: search, $options: 'i' } }
        ];
      }

      const [records, total] = await Promise.all([
        ServiceOrder.find(query)
          .populate('customerId', 'name phone email document')
          .populate('vehicleId', 'plate brand model')
          .populate('technicianId', 'name email')
          .sort({ createdAt: -1 })
          .skip(page * limit)
          .limit(limit)
          .exec(),
        ServiceOrder.countDocuments(query)
      ]);

      return { records, total, page, limit };
    } catch (error) {
      logger.error('ServiceOrderRepository :: findAll >> ', error);
      throw error;
    }
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.findOne({ _id: id, companyId, isActive: true })
      .populate('customerId', 'name phone email document address')
      .populate('technicianId', 'name email')
      .populate('statusHistory.changedBy', 'name');
  }

  async findByOrderNumber(companyId, orderNumber) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.findOne({ companyId, orderNumber, isActive: true })
      .populate('customerId', 'name phone email document address')
      .populate('vehicleId', 'plate brand model year color fuel mileage')
      .populate('technicianId', 'name email');
  }

  async findByCustomer(companyId, customerId) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.find({ companyId, customerId, isActive: true })
      .populate('technicianId', 'name email')
      .sort({ createdAt: -1 });
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await ServiceOrder.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: patch },
      { new: true }
    )
      .populate('customerId', 'name phone email document address')
      .populate('vehicleId', 'plate brand model year color fuel mileage')
      .populate('technicianId', 'name email');
  }

  async addStatusHistory(companyId, id, statusEntry) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $push: { statusHistory: statusEntry } },
      { new: true }
    );
  }

  async addPhoto(companyId, id, photo) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $push: { photos: photo } },
      { new: true }
    );
  }

  async findPhoto(companyId, id, photoId) {
    if (!companyId) throw new Error('companyId is required');
    const order = await ServiceOrder.findOne({ _id: id, companyId, isActive: true }, { photos: 1 });
    if (!order) return null;
    return order.photos.id(photoId);
  }

  async removePhoto(companyId, id, photoId) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $pull: { photos: { _id: photoId } } },
      { new: true }
    );
  }

  async softDelete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: { isActive: false, deletedAt: new Date() } },
      { new: true }
    );
  }

  async countByStatus(companyId) {
    if (!companyId) throw new Error('companyId is required');
    return await ServiceOrder.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
  }

  async serviceOrderDashboard(companyId) {
    if (!companyId) throw new Error('companyId is required');
    const match = { companyId: new mongoose.Types.ObjectId(companyId), isActive: true };
    const now = new Date();
    const eighteenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 17, 1);
    const activeStatuses = ['open', 'diagnosing', 'quoted', 'approved', 'in_progress'];
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const STATUS_LABELS = {
      open: 'Aberta', diagnosing: 'Em Diagnóstico', quoted: 'Orçamento',
      approved: 'Aprovada', in_progress: 'Em Execução',
      completed: 'Concluída', delivered: 'Entregue', cancelled: 'Cancelada'
    };

    const [statusBreakdown, prioritySummary, overdueCount, monthlyTrend] = await Promise.all([
      ServiceOrder.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      ServiceOrder.aggregate([
        { $match: match },
        { $group: {
          _id: null,
          total:     { $sum: 1 },
          low:       { $sum: { $cond: [{ $eq: ['$priority', 'low'] },                        1, 0] } },
          normal:    { $sum: { $cond: [{ $eq: ['$priority', 'normal'] },                     1, 0] } },
          high:      { $sum: { $cond: [{ $eq: ['$priority', 'high'] },                       1, 0] } },
          urgent:    { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] },                     1, 0] } },
          completed: { $sum: { $cond: [{ $in: ['$status', ['completed', 'delivered']] },     1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] },                    1, 0] } }
        }}
      ]),
      ServiceOrder.countDocuments({
        ...match,
        status: { $in: activeStatuses },
        estimatedCompletionDate: { $lt: now }
      }),
      ServiceOrder.aggregate([
        { $match: { ...match, createdAt: { $gte: eighteenMonthsAgo } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

    const sum = prioritySummary[0] || { total: 0, low: 0, normal: 0, high: 0, urgent: 0, completed: 0, cancelled: 0 };
    return {
      summary: { total: sum.total, overdue: overdueCount, completed: sum.completed, cancelled: sum.cancelled },
      byPriority: { low: sum.low, normal: sum.normal, high: sum.high, urgent: sum.urgent },
      byStatus: statusBreakdown.map(s => ({ status: s._id, label: STATUS_LABELS[s._id] || s._id, count: s.count })),
      monthlyTrend: monthlyTrend.map(m => ({
        label: `${MONTHS[m._id.month - 1]}/${String(m._id.year).slice(2)}`,
        count: m.count
      }))
    };
  }
}

export default new ServiceOrderRepository();
