import ItauIntegrationLog from '../../../models/financial/itau/itau-integration-log.model.js';
import logger from '../../../utils/logger.js';

class ItauIntegrationLogRepository {
  async create(data) {
    try {
      const log = new ItauIntegrationLog(data);
      return await log.save();
    } catch (error) {
      // Auditoria nunca pode quebrar o fluxo principal.
      logger.error('ItauIntegrationLogRepository :: create >> ', error);
      return null;
    }
  }

  async list(companyId, { operation, success, boletoId, receivableId, dateFrom, dateTo, page = 0, limit = 20 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId };
    if (operation) query.operation = operation;
    if (success !== undefined && success !== null && success !== '') {
      query.success = success === true || success === 'true';
    }
    if (boletoId) query.boletoId = boletoId;
    if (receivableId) query.receivableId = receivableId;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const [records, total] = await Promise.all([
      ItauIntegrationLog.find(query)
        .populate('boletoId', 'nossoNumero status')
        .populate('receivableId', 'number description')
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .exec(),
      ItauIntegrationLog.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }
}

export default new ItauIntegrationLogRepository();
