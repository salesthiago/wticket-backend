import StockMovement from '../models/stock-movement.model.js';
import logger from '../utils/logger.js';

class StockMovementRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    const movement = new StockMovement(data);
    return await movement.save();
  }

  async findByProduct(companyId, productId, { page = 0, limit = 10 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    try {
      const query = { companyId, productId };

      const [records, total] = await Promise.all([
        StockMovement.find(query)
          .populate('createdBy', 'name')
          .sort({ createdAt: -1 })
          .skip(page * limit)
          .limit(limit)
          .exec(),
        StockMovement.countDocuments(query)
      ]);

      return { records, total, page, limit };
    } catch (error) {
      logger.error('StockMovementRepository :: findByProduct >> ', error);
      throw error;
    }
  }
}

export default new StockMovementRepository();
