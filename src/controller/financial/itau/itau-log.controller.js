import logger from '../../../utils/logger.js';
import itauLogRepository from '../../../repositories/financial/itau/itau-integration-log.repository.js';

export const list = async (req, res) => {
  try {
    const { operation, success, boletoId, receivableId, dateFrom, dateTo, page, limit } = req.query;
    const result = await itauLogRepository.list(req.user.companyId, {
      operation, success, boletoId, receivableId, dateFrom, dateTo,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 20
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('ItauLogController :: list >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
