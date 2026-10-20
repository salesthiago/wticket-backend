import logger from '../utils/logger.js';
import apiKeyRepository from '../repositories/api-key.repository.js';
import companyRepository from '../repositories/company.repository.js';
import subscriptionService from '../services/billing/subscription.service.js';

// Rate limit simples em memória, por chave de API (janela fixa de 1 minuto).
// Suficiente para uma instância; com várias instâncias cada uma conta à parte.
const RATE_LIMIT_PER_MINUTE = 60;
const hits = new Map();

const isRateLimited = (keyId) => {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const entry = hits.get(keyId);
  if (!entry || entry.start < windowStart) {
    hits.set(keyId, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
};

// Autentica integrações externas pelo header `x-api-key` (chave por empresa —
// ver models/api-key.model.js). Não há JWT aqui: os módulos exigidos são
// conferidos direto na Company. Preenche req.companyId e req.apiKey.
export const authenticateApiKey = (...requiredModules) => async (req, res, next) => {
  try {
    const plainKey = req.get('x-api-key');
    if (!plainKey) {
      return res.status(401).json({ message: 'Missing x-api-key header' });
    }

    const apiKey = await apiKeyRepository.findActiveByPlainKey(plainKey);
    if (!apiKey) {
      return res.status(401).json({ message: 'Invalid or revoked API key' });
    }

    if (isRateLimited(String(apiKey._id))) {
      return res.status(429).json({ message: 'Too many requests. Try again in a minute.' });
    }

    const company = await companyRepository.findById(apiKey.companyId);
    if (!company) {
      return res.status(401).json({ message: 'Invalid or revoked API key' });
    }

    const missing = requiredModules.filter(code => !company.hasActiveModule(code));
    if (missing.length) {
      return res.status(403).json({ message: `Module '${missing.join("', '")}' is not active for this company` });
    }

    const billing = await subscriptionService.getBillingStatus(company._id);
    if (billing.blocked) {
      return res.status(402).json({ message: 'Company subscription is pending payment', code: 'SUBSCRIPTION_PAYMENT_REQUIRED' });
    }

    req.companyId = String(company._id);
    req.apiKey = apiKey;
    apiKeyRepository.touch(apiKey._id).catch(() => {});
    next();
  } catch (err) {
    logger.error('ApiKeyMiddleware :: authenticateApiKey >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
