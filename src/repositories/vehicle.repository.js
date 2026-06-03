import Vehicle from '../models/vehicle.model.js';
import logger from '../utils/logger.js';

class VehicleRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    if (!data.customerId) throw new Error('customerId is required');
    const vehicle = new Vehicle(data);
    return await vehicle.save();
  }

  async findAll(companyId, { customerId, search, page = 0, limit = 10 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId, isActive: true };
    if (customerId) query.customerId = customerId;

    if (search) {
      query.$or = [
        { plate: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    const [records, total] = await Promise.all([
      Vehicle.find(query)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .exec(),
      Vehicle.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }

  async findByCustomer(companyId, customerId) {
    if (!companyId) throw new Error('companyId is required');
    // Favorito primeiro, depois o mais recente — facilita a pré-seleção na OS.
    return await Vehicle.find({ companyId, customerId, isActive: true }).sort({ favorite: -1, createdAt: -1 });
  }

  // Remove a marca de favorito de outros veículos do mesmo cliente, garantindo
  // que exista no máximo um favorito por cliente.
  async unsetFavorites(companyId, customerId, exceptId = null) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId, customerId, favorite: true };
    if (exceptId) query._id = { $ne: exceptId };
    return await Vehicle.updateMany(query, { $set: { favorite: false } });
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await Vehicle.findOne({ _id: id, companyId, isActive: true });
  }

  async findByPlate(companyId, plate) {
    if (!companyId) throw new Error('companyId is required');
    return await Vehicle.findOne({ companyId, plate, isActive: true });
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    delete patch.customerId;
    return await Vehicle.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: patch },
      { new: true }
    );
  }

  async softDelete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    try {
      return await Vehicle.findOneAndUpdate(
        { _id: id, companyId, isActive: true },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      );
    } catch (error) {
      logger.error('VehicleRepository :: softDelete >> ', error);
      throw error;
    }
  }
}

export default new VehicleRepository();
