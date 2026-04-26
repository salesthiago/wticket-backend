import Lead from '../models/lead.model.js';
import logger from '../utils/logger.js';

class LeadRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    const lead = new Lead(data);
    return await lead.save();
  }

  async findAll(companyId, { search, status, page = 0, limit = 10 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId, isActive: true };

    if (status) query.status = status;

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
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await Lead.findOne({ _id: id, companyId, isActive: true })
      .populate('convertedTo', 'name email phone');
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await Lead.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: patch },
      { new: true }
    );
  }

  async convertToCustomer(companyId, id, customerId) {
    if (!companyId) throw new Error('companyId is required');
    return await Lead.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      {
        $set: {
          status: 'converted',
          convertedTo: customerId,
          convertedAt: new Date()
        }
      },
      { new: true }
    );
  }

  async softDelete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    try {
      return await Lead.findOneAndUpdate(
        { _id: id, companyId, isActive: true },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      );
    } catch (error) {
      logger.error('LeadRepository :: softDelete >> ', error);
      throw error;
    }
  }
}

export default new LeadRepository();
