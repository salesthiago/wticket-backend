import logger from '../../utils/logger.js';
import paymentSettingsService from '../../services/billing/payment-settings.service.js';

function sendError(res, err, fallback = 'Internal server error') {
  const status = err?.status || 500;
  if (status >= 500) logger.error('PaymentSettings controller error', err);
  return res.status(status).json({ message: err?.message || fallback });
}

// GET /api/billing/settings  (super-admin)
export const get = async (req, res) => {
  try {
    return res.json(await paymentSettingsService.getForAdmin());
  } catch (err) {
    return sendError(res, err);
  }
};

// PUT /api/billing/settings  (super-admin)
export const update = async (req, res) => {
  try {
    const { methods, abacatepay, itau, inter, stripe } = req.body || {};
    const saved = await paymentSettingsService.save(
      { methods, abacatepay, itau, inter, stripe },
      req.user?.sub || req.user?.id
    );
    return res.json(saved);
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/billing/settings/:provider/certificate  (multipart: file) — itau | inter
export const uploadCertificate = async (req, res) => {
  try {
    return res.json(await paymentSettingsService.uploadCertificate(req.params.provider, req.file));
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/billing/settings/:provider/private-key  (multipart: file) — itau | inter
export const uploadPrivateKey = async (req, res) => {
  try {
    return res.json(await paymentSettingsService.uploadPrivateKey(req.params.provider, req.file));
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/billing/settings/inter/webhook → cadastra a URL de webhook no Inter
export const registerInterWebhook = async (req, res) => {
  try {
    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    return res.json(await paymentSettingsService.registerInterWebhooks(baseUrl, req.user?.sub || req.user?.id));
  } catch (err) {
    return sendError(res, err);
  }
};
