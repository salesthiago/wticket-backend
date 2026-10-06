import ItauConfig from '../../../models/financial/itau/itau-config.model.js';
import logger from '../../../utils/logger.js';

class ItauConfigRepository {
  async findByCompany(companyId) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauConfig.findOne({ companyId });
  }

  async upsert(companyId, data) {
    if (!companyId) throw new Error('companyId is required');
    try {
      const patch = { ...data };
      delete patch.companyId;
      delete patch.certificate;   // tratados por métodos dedicados
      delete patch.privateKey;
      delete patch.proximoNossoNumero;
      return await ItauConfig.findOneAndUpdate(
        { companyId },
        { $set: patch, $setOnInsert: { companyId } },
        { new: true, upsert: true }
      );
    } catch (error) {
      logger.error('ItauConfigRepository :: upsert >> ', error);
      throw error;
    }
  }

  async setCertificate(companyId, certificate) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauConfig.findOneAndUpdate(
      { companyId },
      { $set: { certificate } },
      { new: true, upsert: true }
    );
  }

  async setPrivateKey(companyId, privateKey) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauConfig.findOneAndUpdate(
      { companyId },
      { $set: { privateKey } },
      { new: true, upsert: true }
    );
  }

  async clearCertificate(companyId) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauConfig.findOneAndUpdate(
      { companyId },
      { $set: { certificate: null } },
      { new: true }
    );
  }

  async clearPrivateKey(companyId) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauConfig.findOneAndUpdate(
      { companyId },
      { $set: { privateKey: null } },
      { new: true }
    );
  }

  async setTestResult(companyId, ok) {
    if (!companyId) throw new Error('companyId is required');
    return await ItauConfig.findOneAndUpdate(
      { companyId },
      { $set: { testedAt: new Date(), testOk: !!ok } },
      { new: true }
    );
  }

  async allocateNextNossoNumero(companyId) {
    return await ItauConfig.allocateNextNossoNumero(companyId);
  }
}

export default new ItauConfigRepository();
