import NfseConfig from '../../models/nfse/nfse-config.model.js';
import logger from '../../utils/logger.js';

class NfseConfigRepository {
  async findByCompany(companyId) {
    if (!companyId) throw new Error('companyId is required');
    return await NfseConfig.findOne({ companyId });
  }

  async upsert(companyId, data) {
    if (!companyId) throw new Error('companyId is required');
    try {
      const patch = { ...data };
      delete patch.companyId;
      delete patch.certificate; // certificado é tratado por método dedicado
      return await NfseConfig.findOneAndUpdate(
        { companyId },
        { $set: patch, $setOnInsert: { companyId } },
        { new: true, upsert: true }
      );
    } catch (error) {
      logger.error('NfseConfigRepository :: upsert >> ', error);
      throw error;
    }
  }

  async setCertificate(companyId, certificate) {
    if (!companyId) throw new Error('companyId is required');
    return await NfseConfig.findOneAndUpdate(
      { companyId },
      { $set: { certificate } },
      { new: true, upsert: true }
    );
  }

  async clearCertificate(companyId) {
    if (!companyId) throw new Error('companyId is required');
    return await NfseConfig.findOneAndUpdate(
      { companyId },
      { $set: { certificate: null } },
      { new: true }
    );
  }

  /**
   * Ajusta a numeração após uma série/nDPS definidos manualmente (correção de
   * emissão rejeitada): a série vira a série atual da empresa e o próximo
   * número segue a partir do maior já usado nela. Na mesma série nunca volta
   * para trás ($max), para não gerar DPS repetida; ao trocar de série a
   * sequência passa a ser a da nova série.
   */
  async syncNumbering(companyId, { serie, nextNumber }) {
    const config = await NfseConfig.findOne({ companyId }).select('serie');
    if (!config) return null;
    const update = config.serie === serie
      ? { $max: { proximoNumeroDps: nextNumber } }
      : { $set: { serie, proximoNumeroDps: nextNumber } };
    return await NfseConfig.findOneAndUpdate({ companyId }, update, { new: true });
  }

  async allocateNextDps(companyId) {
    return await NfseConfig.allocateNextDps(companyId);
  }
}

export default new NfseConfigRepository();
