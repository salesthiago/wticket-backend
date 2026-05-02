import NfseIssuance from '../../models/nfse/nfse-issuance.model.js';
import NfseWsLog from '../../models/nfse/nfse-ws-log.model.js';
import logger from '../../utils/logger.js';

class NfseIssuanceRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    try {
      const doc = new NfseIssuance(data);
      return await doc.save();
    } catch (error) {
      logger.error('NfseIssuanceRepository :: create >> ', error);
      throw error;
    }
  }

  async findAll(companyId, { search, status, customerId, serviceOrderId, dateFrom, dateTo, page = 0, limit = 20 } = {}) {
    if (!companyId) throw new Error('companyId is required');

    const query = { companyId, isActive: true };
    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (serviceOrderId) query.serviceOrderId = serviceOrderId;
    if (dateFrom || dateTo) {
      query.dhEmi = {};
      if (dateFrom) query.dhEmi.$gte = new Date(dateFrom);
      if (dateTo) query.dhEmi.$lte = new Date(dateTo);
    }
    if (search) {
      const rx = new RegExp(search, 'i');
      query.$or = [
        { numeroNfse: rx },
        { chaveAcesso: rx },
        { 'tomador.nome': rx },
        { 'tomador.document': rx },
        { 'servico.xDescServ': rx }
      ];
    }

    const [records, total] = await Promise.all([
      NfseIssuance.find(query)
        .populate('customerId', 'name document')
        .populate('serviceOrderId', 'orderNumber')
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .select('-xmlDpsAssinado -xmlNfseRetorno')
        .exec(),
      NfseIssuance.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await NfseIssuance.findOne({ _id: id, companyId, isActive: true })
      .populate('customerId', 'name document email phone address')
      .populate('serviceOrderId', 'orderNumber');
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await NfseIssuance.findOneAndUpdate(
      { _id: id, companyId },
      { $set: patch },
      { new: true }
    );
  }

  async softDelete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await NfseIssuance.findOneAndUpdate(
      { _id: id, companyId, isActive: true },
      { $set: { isActive: false } },
      { new: true }
    );
  }

  async logWsCall(data) {
    try {
      const log = new NfseWsLog(data);
      return await log.save();
    } catch (error) {
      logger.error('NfseIssuanceRepository :: logWsCall >> ', error);
      // não propagar — auditoria não pode quebrar o fluxo
      return null;
    }
  }

  async findLogs(companyId, { issuanceId, operation, page = 0, limit = 20 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId };
    if (issuanceId) query.issuanceId = issuanceId;
    if (operation) query.operation = operation;
    const [records, total] = await Promise.all([
      NfseWsLog.find(query).sort({ createdAt: -1 }).skip(page * limit).limit(limit).exec(),
      NfseWsLog.countDocuments(query)
    ]);
    return { records, total, page, limit };
  }
}

export default new NfseIssuanceRepository();
