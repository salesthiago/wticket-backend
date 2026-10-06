import logger from '../../../utils/logger.js';
import itauConfigService from '../../../services/financial/itau/itau-config.service.js';

export const get = async (req, res) => {
  try {
    const data = await itauConfigService.get(req.user.companyId);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: get >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const status = async (req, res) => {
  try {
    const data = await itauConfigService.status(req.user.companyId);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: status >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const upsert = async (req, res) => {
  try {
    const data = await itauConfigService.upsert(req.user.companyId, req.body || {});
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: upsert >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const uploadCertificate = async (req, res) => {
  try {
    const data = await itauConfigService.uploadCertificate(req.user.companyId, req.file);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: uploadCertificate >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const uploadPrivateKey = async (req, res) => {
  try {
    const data = await itauConfigService.uploadPrivateKey(req.user.companyId, req.file);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: uploadPrivateKey >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const removeCertificate = async (req, res) => {
  try {
    const data = await itauConfigService.removeCertificate(req.user.companyId);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: removeCertificate >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const removePrivateKey = async (req, res) => {
  try {
    const data = await itauConfigService.removePrivateKey(req.user.companyId);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: removePrivateKey >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const testConnection = async (req, res) => {
  try {
    const data = await itauConfigService.testConnection(req.user.companyId);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('ItauConfigController :: testConnection >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Falha no teste de conexão' });
  }
};
