import logger from '../../utils/logger.js';
import nfseServiceCodeRepository from '../../repositories/nfse/nfse-service-code.repository.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, isActive, page, limit } = req.query;
    const result = await nfseServiceCodeRepository.findAll(companyId, {
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 20
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('NfseServiceCodeController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const doc = await nfseServiceCodeRepository.findById(companyId, id);
    if (!doc) return res.status(404).json({ message: 'Service code not found' });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('NfseServiceCodeController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { cTribNac, descricao, aliqISSQN } = req.body;

    if (!cTribNac || !descricao || aliqISSQN === undefined) {
      return res.status(422).json({
        message: 'Campos cTribNac, descricao e aliqISSQN são obrigatórios'
      });
    }
    if (!/^\d{6}$/.test(String(cTribNac))) {
      return res.status(422).json({ message: 'cTribNac deve conter exatamente 6 dígitos' });
    }

    const doc = await nfseServiceCodeRepository.create({
      ...req.body,
      companyId
    });
    return res.status(201).json(doc);
  } catch (err) {
    logger.error('NfseServiceCodeController :: create >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(422).json({ message: 'Body is empty' });
    }
    const doc = await nfseServiceCodeRepository.update(companyId, id, body);
    if (!doc) return res.status(404).json({ message: 'Service code not found' });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('NfseServiceCodeController :: update >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const doc = await nfseServiceCodeRepository.destroy(companyId, id);
    if (!doc) return res.status(404).json({ message: 'Service code not found' });
    return res.status(200).json({ message: 'Service code removed' });
  } catch (err) {
    logger.error('NfseServiceCodeController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
