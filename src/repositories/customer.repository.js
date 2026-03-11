import Customer from '../models/customer.model.js';
import logger from '../utils/logger.js';

class CustomerRepository {
  async create(data) {
    try {
      const customer = new Customer(data);
      return await customer.save();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findAll({ search, page = 0, limit = 10 } = {}) {
    try {
      const query = { isActive: true };

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
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findById(id) {
    try {
      return await Customer.findOne({ _id: id, isActive: true });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findByDocument(document) {
    try {
      return await Customer.findOne({ document, isActive: true });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findByPhone(phone) {
    try {
      return await Customer.findOne({ phone, isActive: true });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async update(id, data) {
    try {
      return await Customer.findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: data },
        { new: true }
      );
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async softDelete(id) {
    try {
      return await Customer.findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      );
    } catch (error) {
      logger.error('CustomerRepository :: softDelete >> ', error);
      throw new Error(error.message);
    }
  }
}

export default new CustomerRepository();
