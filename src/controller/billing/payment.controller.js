import logger from '../../utils/logger.js';
import subscriptionService from '../../services/billing/subscription.service.js';
import { getConfig } from '../../config/abacatepay.js';
import { verifyWebhookSignature } from '../../services/billing/abacatepay.service.js';
import paymentSettingsService from '../../services/billing/payment-settings.service.js';
import registry from '../../services/billing/providers/index.js';

function sendError(res, err, fallback = 'Internal server error') {
  const status = err?.status || 500;
  if (status >= 500) logger.error('Billing controller error', err);
  return res.status(status).json({ message: err?.message || fallback });
}

// Resolve a empresa-alvo: super_admin pode cobrar qualquer empresa (companyId no body);
// demais usuários ficam restritos à própria empresa do token.
function resolveCompanyId(req) {
  if (req.user?.role === 'super_admin' && req.body?.companyId) return req.body.companyId;
  return req.user?.companyId || null;
}

// POST /api/billing/checkout  → cria a cobrança e devolve o link de pagamento
export const checkout = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) {
      return res.status(403).json({ message: 'Usuário não está vinculado a uma empresa' });
    }
    const { planId, payer, completionUrl, returnUrl } = req.body || {};
    const result = await subscriptionService.createCheckout({
      companyId, planId, payer, completionUrl, returnUrl
    });
    return res.status(201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/billing/:id → status da cobrança (lido do nosso registro, atualizado pelo webhook)
export const getStatus = async (req, res) => {
  try {
    const payment = await subscriptionService.getPayment(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Cobrança não encontrada' });

    const isSuperAdmin = req.user?.role === 'super_admin';
    const isOwn = String(payment.companyId) === String(req.user?.companyId);
    if (!isSuperAdmin && !isOwn) return res.status(403).json({ message: 'Forbidden' });

    return res.json({
      id: payment._id,
      status: payment.status,
      amount: payment.amount,
      moduleCodes: payment.moduleCodes,
      url: payment.checkoutUrl,
      paidAt: payment.paidAt,
      providerBillingId: payment.providerBillingId
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/billing/webhook?webhookSecret=...  (público — chamado pela AbacatePay)
// Valida o segredo via query param e libera a assinatura no evento billing.paid.
export const webhook = async (req, res) => {
  // 1) Secret na query string (gate primário)
  const { webhookSecret } = getConfig();
  if (!webhookSecret || req.query.webhookSecret !== webhookSecret) {
    logger.warn('Billing :: webhook rejeitado (webhookSecret inválido)');
    return res.status(401).json({ message: 'invalid webhook secret' });
  }

  // 2) Assinatura HMAC (quando enviada) — valida que o corpo não foi alterado
  const signature = req.headers['x-webhook-signature'];
  if (signature) {
    if (!verifyWebhookSignature(req.rawBody, signature)) {
      logger.warn('Billing :: webhook rejeitado (assinatura HMAC inválida)');
      return res.status(401).json({ message: 'invalid signature' });
    }
  }

  try {
    // Assinaturas: subscription.completed/renewed/trial_started. Legado: checkout.completed/billing.paid.
    await subscriptionService.handleWebhookEvent(req.body);
    return res.status(200).json({ received: true });
  } catch (err) {
    // 500 faz a AbacatePay reenviar — bom para falhas transitórias.
    logger.error('Billing :: erro ao processar webhook', err);
    return res.status(500).json({ message: 'webhook processing failed' });
  }
};

// POST /api/billing/webhook/itau  (público — chamado pelo Itaú)
// Valida o HMAC no provider.parseWebhook e libera/renova a assinatura.
export const itauWebhook = async (req, res) => {
  try {
    const config = await paymentSettingsService.getConfigFor('itau');
    const event = registry.get('itau').parseWebhook(req.rawBody, req.headers, req.query, config);
    await subscriptionService.handleItauWebhook(event);
    return res.status(200).json({ received: true });
  } catch (err) {
    const status = err?.status || 500;
    if (status === 401) {
      logger.warn('Billing :: webhook Itaú rejeitado (assinatura inválida)');
      return res.status(401).json({ message: 'invalid signature' });
    }
    logger.error('Billing :: erro ao processar webhook Itaú', err);
    return res.status(500).json({ message: 'webhook processing failed' });
  }
};
