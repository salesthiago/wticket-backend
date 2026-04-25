import ServiceOrder from '../models/service-order.model.js';
import logger from '../utils/logger.js';

class ServiceOrderRepository {
  async create(data) {
    try {
      const serviceOrder = new ServiceOrder(data);
      return await serviceOrder.save();
    } catch (error) {
      logger.error('ServiceOrderRepository :: create >> ', error);
      throw new Error(error.message);
    }
  }

  async findAll({ search, status, priority, technicianId, customerId, page = 0, limit = 10 } = {}) {
    try {
      const query = { isActive: true };

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
      throw new Error(error.message);
    }
  }

  async findById(id) {
    try {
      return await ServiceOrder.findOne({ _id: id, isActive: true })
        .populate('customerId', 'name phone email document address')
        .populate('technicianId', 'name email')
        .populate('statusHistory.changedBy', 'name');
    } catch (error) {
      logger.error('ServiceOrderRepository :: findById >> ', error);
      throw new Error(error.message);
    }
  }

  async findByOrderNumber(orderNumber) {
    try {
      return await ServiceOrder.findOne({ orderNumber, isActive: true })
        .populate('customerId', 'name phone email document address')
        .populate('technicianId', 'name email');
    } catch (error) {
      logger.error('ServiceOrderRepository :: findByOrderNumber >> ', error);
      throw new Error(error.message);
    }
  }

  async findByCustomer(customerId) {
    try {
      return await ServiceOrder.find({ customerId, isActive: true })
        .populate('technicianId', 'name email')
        .sort({ createdAt: -1 });
    } catch (error) {
      logger.error('ServiceOrderRepository :: findByCustomer >> ', error);
      throw new Error(error.message);
    }
  }

  async update(id, data) {
    try {
      return await ServiceOrder.findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: data },
        { new: true }
      )
        .populate('customerId', 'name phone email document address')
        .populate('technicianId', 'name email');
    } catch (error) {
      logger.error('ServiceOrderRepository :: update >> ', error);
      throw new Error(error.message);
    }
  }

  async addStatusHistory(id, statusEntry) {
    try {
      return await ServiceOrder.findOneAndUpdate(
        { _id: id, isActive: true },
        { $push: { statusHistory: statusEntry } },
        { new: true }
      );
    } catch (error) {
      logger.error('ServiceOrderRepository :: addStatusHistory >> ', error);
      throw new Error(error.message);
    }
  }

  async softDelete(id) {
    try {
      return await ServiceOrder.findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      );
    } catch (error) {
      logger.error('ServiceOrderRepository :: softDelete >> ', error);
      throw new Error(error.message);
    }
  }

  async countByStatus() {
    try {
      return await ServiceOrder.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
    } catch (error) {
      logger.error('ServiceOrderRepository :: countByStatus >> ', error);
      throw new Error(error.message);
    }
  }
}

export default new ServiceOrderRepository();
