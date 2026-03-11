import Lead from '../models/lead.model.js';
import logger from '../utils/logger.js';

class LeadRepository {
  async create(data) {
    try {
      const lead = new Lead(data);
      return await lead.save();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findAll({ search, status, page = 0, limit = 10 } = {}) {
    try {
      const query = { isActive: true };

      if (status) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { document: { $regex: search, $options: 'i' } }
        ];
      }

      const [records, total] = await Promise.all([
        Lead.find(query)
          .sort({ createdAt: -1 })
          .skip(page * limit)
          .limit(limit)
          .exec(),
        Lead.countDocuments(query)
      ]);

      return { records, total, page, limit };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findById(id) {
    try {
      return await Lead.findOne({ _id: id, isActive: true })
        .populate('convertedTo', 'name email phone');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async update(id, data) {
    try {
      return await Lead.findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: data },
        { new: true }
      );
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async convertToCustomer(id, customerId) {
    try {
      return await Lead.findOneAndUpdate(
        { _id: id, isActive: true },
        {
          $set: {
            status: 'converted',
            convertedTo: customerId,
            convertedAt: new Date()
          }
        },
        { new: true }
      );
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async softDelete(id) {
    try {
      return await Lead.findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      );
    } catch (error) {
      logger.error('LeadRepository :: softDelete >> ', error);
      throw new Error(error.message);
    }
  }
}

export default new LeadRepository();
