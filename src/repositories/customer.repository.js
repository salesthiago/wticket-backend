import Customer from '../models/customer.model.js';
import logger from '../utils/logger.js';

class CustomerRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    const customer = new Customer(data);
    return await customer.save();
  }

  async findAll(companyId, { search, page = 0, limit = 10 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId, isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { document: { $regex: search, $options: 'i' } }
      ];
    }

    const [records, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .exec(),
      Customer.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await Customer.findOne({ _id: id, companyId, isActive: true });
  }

  async findByDocument(companyId, document) {
    if (!companyId) throw new Error('companyId is required');
    return await Customer.findOne({ companyId, document, isActive: true });
  }

  async findByPhone(companyId, phone) {
    if (!companyId) throw new Error('companyId is required');
    return await Customer.findOne({ companyId, phone, isActive: true });
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await Customer.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: patch },
      { new: true }
    );
  }

  async softDelete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    try {
      return await Customer.findOneAndUpdate(
        { _id: id, companyId, isActive: true },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      );
    } catch (error) {
      logger.error('CustomerRepository :: softDelete >> ', error);
      throw error;
    }
  }
}

export default new CustomerRepository();
