import logger from '../utils/logger.js';
import emailService, { validateCredentials } from '../services/email/email.service.js';

export const getConfig = async (req, res) => {
  try {
    const config = await emailService.getConfigForAdmin();
    return res.json(config);
  } catch (err) {
    logger.error('EmailConfig getConfig error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const { status, region, accessKeyId, secretKey, fromEmail, fromName } = req.body || {};
    if (status && !['enabled', 'disabled'].includes(status)) {
      return res.status(422).json({ message: 'status deve ser "enabled" ou "disabled"' });
    }
    const credErrors = validateCredentials({ accessKeyId, secretKey });
    if (credErrors.length) return res.status(422).json({ message: credErrors.join('; '), errors: credErrors });

    await emailService.saveConfig({ status, region, accessKeyId, secretKey, fromEmail, fromName });
    return res.json(await emailService.getConfigForAdmin());
  } catch (err) {
    logger.error('EmailConfig updateConfig error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const sendTestEmail = async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(422).json({ message: 'Campo "to" é obrigatório' });
    await emailService.sendTest(to);
    return res.json({ message: `E-mail de teste enviado para ${to}` });
  } catch (err) {
    logger.warn(`EmailConfig sendTestEmail :: falha ao enviar: ${err.message}`);
    return res.status(422).json({ message: err.message || 'Falha ao enviar e-mail de teste' });
  }
};

export const listTemplates = async (req, res) => {
  try {
    const templates = await emailService.listTemplates();
    return res.json(templates);
  } catch (err) {
    logger.error('EmailConfig listTemplates error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const { code } = req.params;
    const { subject, body } = req.body || {};
    if (!subject || !String(subject).trim()) return res.status(422).json({ message: 'subject é obrigatório' });
    if (!body || !String(body).trim()) return res.status(422).json({ message: 'body é obrigatório' });

    const saved = await emailService.saveTemplate(code, { subject, body });
    return res.json(saved.value);
  } catch (err) {
    if (/Template desconhecido/.test(err.message)) {
      return res.status(404).json({ message: err.message });
    }
    logger.error('EmailConfig updateTemplate error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
