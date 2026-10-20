import crypto from 'crypto';
import ApiKey from '../models/api-key.model.js';

const KEY_PREFIX = 'wtk_';

export const hashApiKey = (plainKey) =>
  crypto.createHash('sha256').update(String(plainKey), 'utf8').digest('hex');

class ApiKeyRepository {
  // Gera uma chave nova e devolve { apiKey (doc), plainKey } — plainKey não é
  // persistida e só pode ser mostrada ao usuário neste momento.
  async create({ companyId, name, createdBy }) {
    if (!companyId) throw new Error('companyId is required');
    const plainKey = KEY_PREFIX + crypto.randomBytes(24).toString('hex');
    const apiKey = await ApiKey.create({
      companyId,
      name,
      createdBy,
      keyPrefix: plainKey.slice(0, KEY_PREFIX.length + 6),
      keyHash: hashApiKey(plainKey)
    });
    return { apiKey, plainKey };
  }

  async findAll(companyId) {
    if (!companyId) throw new Error('companyId is required');
    return await ApiKey.find({ companyId })
      .select('-keyHash')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
  }

  async findActiveByPlainKey(plainKey) {
    if (!plainKey) return null;
    return await ApiKey.findOne({ keyHash: hashApiKey(plainKey), revokedAt: null });
  }

  async touch(id) {
    return await ApiKey.updateOne({ _id: id }, { $set: { lastUsedAt: new Date() } });
  }

  async revoke(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await ApiKey.findOneAndUpdate(
      { _id: id, companyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { new: true }
    ).select('-keyHash');
  }
}

export default new ApiKeyRepository();
