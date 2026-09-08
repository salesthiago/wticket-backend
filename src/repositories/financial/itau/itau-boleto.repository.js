import ItauBoleto from '../../../models/financial/itau/itau-boleto.model.js';
import logger from '../../../utils/logger.js';

class ItauBoletoRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    try {
      const doc = new ItauBoleto(data);
      return await doc.save();
    } catch (error) {
      logger.error('ItauBoletoRepository :: create >> ', error);
      throw error;
    }
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauBoleto.findOne({ _id: id, companyId, isActive: true })
      .populate('receivableId', 'number description amount dueDate status')
      .populate('customerId', 'name document email phone address')
      .populate('createdBy', 'name email');
  }

  async findActiveByReceivable(companyId, receivableId) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauBoleto.findOne({
      companyId,
      receivableId,
      isActive: true,
      status: { $ne: 'cancelado' }
    }).sort({ createdAt: -1 });
  }

  async list(companyId, { status, receivableId, dateFrom, dateTo, page = 0, limit = 20 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId, isActive: true };
    if (status) query.status = status;
    if (receivableId) query.receivableId = receivableId;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const [records, total] = await Promise.all([
      ItauBoleto.find(query)
        .populate('receivableId', 'number description amount dueDate status')
        .populate('customerId', 'name document')
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .select('-rawRequest -rawResponse -pix.qrCodeImage')
        .exec(),
      ItauBoleto.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    delete patch.receivableId;
    return await ItauBoleto.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: patch },
      { new: true }
    );
  }

  async pushStatus(companyId, id, statusEntry) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauBoleto.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: { status: statusEntry.status }, $push: { statusHistory: statusEntry } },
      { new: true }
    );
  }

  async softDelete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauBoleto.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: { isActive: false, deletedAt: new Date() } },
      { new: true }
    );
  }

  // Localiza um boleto por nosso número ou id do Itaú (usado pelo webhook,
  // que não tem o _id nem escopo de tenant garantido).
  async findByExternalRef(companyId, { nossoNumero, itauId, txid }) {
    const or = [];
    if (nossoNumero) or.push({ nossoNumero });
    if (itauId) or.push({ itauId });
    if (txid) or.push({ txid });
    if (!or.length) return null;
    const query = { isActive: true, $or: or };
    if (companyId) query.companyId = companyId;
    return await ItauBoleto.findOne(query).sort({ createdAt: -1 });
  }
}

export default new ItauBoletoRepository();
