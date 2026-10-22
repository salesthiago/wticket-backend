import Stripe from 'stripe';
import logger from '../../../utils/logger.js';

// Provedor Stripe — cartão via Stripe Checkout hospedado (pagamento avulso por
// período, igual ao Pix do Itaú: cada cobrança paga libera `periodDays`).
//
// Credenciais (secret key, webhook secret) vêm do payment-settings.service —
// configuráveis no painel super-admin, com fallback para STRIPE_* do .env.
// A versão da API não é fixada aqui: vale a padrão do SDK instalado.

const clients = new Map();
function client(secretKey) {
  if (!clients.has(secretKey)) clients.set(secretKey, new Stripe(secretKey));
  return clients.get(secretKey);
}

export const stripeProvider = {
  key: 'stripe',
  supportedMethods: ['credit_card'],
  supportsRecurring: false,

  isConfigured(config) {
    const c = config || {};
    return !!(c.enabled && c.secretKey);
  },

  async createCharge(request, config) {
    if (!this.isConfigured(config)) {
      throw Object.assign(new Error('Stripe não está ativo/configurado (secret key obrigatória).'), { status: 422 });
    }

    const unitAmount = Math.round(Number(request.amount || 0) * 100);
    if (unitAmount <= 0) throw Object.assign(new Error('Valor da cobrança inválido'), { status: 422 });

    let session;
    try {
      session = await client(config.secretKey).checkout.sessions.create({
        // Parâmetros definidos no Checkout Studio (dashboard Stripe).
        ui_mode: 'hosted_page',
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: false },
        automatic_tax: { enabled: false },
        allow_promotion_codes: false,
        submit_type: 'auto',
        integration_identifier: 'hosted_web_0001',
        origin_context: 'web',
        mode: 'payment',
        success_url: request.completionUrl,
        cancel_url: request.returnUrl,
        // Catálogo externo: o preço vem do plano do WTicket, não de um Price da Stripe.
        line_items: [{
          price_data: {
            currency: 'brl',
            product_data: { name: request.description || 'Assinatura WTicket' },
            unit_amount: unitAmount
          },
          quantity: 1
        }],
        customer_email: request.payer?.email || undefined,
        client_reference_id: String(request.companyId),
        metadata: { companyId: String(request.companyId), planId: String(request.planId || '') }
      });
    } catch (err) {
      logger.error(`Billing :: Stripe createCharge falhou :: ${err.message}`);
      throw Object.assign(new Error(err.message || 'Falha ao gerar o checkout na Stripe'), {
        status: err.statusCode && err.statusCode < 500 ? err.statusCode : 422
      });
    }

    logger.info(`Billing :: Stripe checkout ${session.id} criado p/ empresa ${request.companyId} (R$ ${request.amount})`);
    return {
      provider: 'stripe',
      providerBillingId: session.id,
      checkoutUrl: session.url,
      amount: request.amount,
      status: 'pending',
      raw: { environment: config.environment }
    };
  },

  // Webhook da Stripe. Valida a assinatura (stripe-signature) e normaliza para
  // { providerBillingId, status, raw }. Eventos irrelevantes devolvem null.
  parseWebhook(rawBody, headers, _query, config) {
    if (!config?.webhookSecret || !config?.secretKey) {
      throw Object.assign(new Error('Webhook Stripe sem segredo configurado'), { status: 401 });
    }
    let event;
    try {
      event = client(config.secretKey).webhooks.constructEvent(rawBody, headers['stripe-signature'], config.webhookSecret);
    } catch (err) {
      throw Object.assign(new Error(`Assinatura de webhook Stripe inválida: ${err.message}`), { status: 401 });
    }

    const session = event.data?.object || {};
    let status = null;
    switch (event.type) {
      case 'checkout.session.completed':
        // Boleto/métodos assíncronos chegam 'unpaid' aqui e confirmam depois.
        if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') status = 'paid';
        break;
      case 'checkout.session.async_payment_succeeded':
        status = 'paid';
        break;
      case 'checkout.session.async_payment_failed':
        status = 'cancelled';
        break;
      case 'checkout.session.expired':
        status = 'expired';
        break;
    }
    if (!status) return null;
    return { providerBillingId: session.id, status, raw: { id: event.id, type: event.type } };
  }
};

export default stripeProvider;
