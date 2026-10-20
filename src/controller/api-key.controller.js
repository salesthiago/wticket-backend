import logger from '../utils/logger.js';
import apiKeyRepository from '../repositories/api-key.repository.js';

export const findAll = async (req, res) => {
  try {
    const keys = await apiKeyRepository.findAll(req.user.companyId);
    return res.status(200).json(keys);
  } catch (err) {
    logger.error('ApiKeyController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// A chave em claro só volta nesta resposta — depois disso não há como recuperá-la.
export const create = async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    if (!name) return res.status(422).json({ message: 'Field name is required' });

    const { apiKey, plainKey } = await apiKeyRepository.create({
      companyId: req.user.companyId,
      name,
      createdBy: req.user.sub
    });

    const doc = apiKey.toObject();
    delete doc.keyHash;
    return res.status(201).json({ ...doc, key: plainKey });
  } catch (err) {
    logger.error('ApiKeyController :: create >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const revoke = async (req, res) => {
  try {
    const apiKey = await apiKeyRepository.revoke(req.user.companyId, req.params.id);
    if (!apiKey) return res.status(404).json({ message: 'API key not found' });
    return res.status(200).json(apiKey);
  } catch (err) {
    logger.error('ApiKeyController :: revoke >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
