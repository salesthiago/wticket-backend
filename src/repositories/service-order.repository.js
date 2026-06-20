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
      { $match: { companyId, isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
  }
}

export default new ServiceOrderRepository();
