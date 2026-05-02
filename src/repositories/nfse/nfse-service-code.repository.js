import NfseServiceCode from '../../models/nfse/nfse-service-code.model.js';
import logger from '../../utils/logger.js';

class NfseServiceCodeRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    try {
      const doc = new NfseServiceCode(data);
      return await doc.save();
    } catch (error) {
      logger.error('NfseServiceCodeRepository :: create >> ', error);
      throw error;
    }
  }

  async findAll(companyId, { search, isActive, page = 0, limit = 20 } = {}) {
    if (!companyId) throw new Error('companyId is required');

    const query = { companyId };
    if (typeof isActive === 'boolean') query.isActive = isActive;

    if (search) {
      const rx = new RegExp(search, 'i');
      query.$or = [
        { descricao: rx },
        { cTribNac: rx },
        { cTribMun: rx },
        { cNBS: rx }
      ];
    }

    const [records, total] = await Promise.all([
      NfseServiceCode.find(query)
        .sort({ descricao: 1 })
        .skip(page * limit)
        .limit(limit)
        .exec(),
      NfseServiceCode.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await NfseServiceCode.findOne({ _id: id, companyId });
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await NfseServiceCode.findOneAndUpdate(
      { _id: id, companyId },
      { $set: patch },
      { new: true }
    );
  }

  async destroy(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await NfseServiceCode.findOneAndUpdate(
      { _id: id, companyId },
      { $set: { isActive: false } },
      { new: true }
    );
  }
}

export default new NfseServiceCodeRepository();
