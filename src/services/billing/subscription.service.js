import logger from '../../utils/logger.js';
import companyRepository from '../../repositories/company.repository.js';
import moduleRepository from '../../repositories/module.repository.js';
import planRepository from '../../repositories/plan.repository.js';
import paymentRepository from '../../repositories/billing/payment.repository.js';
import { cycleToDays } from '../../models/plan.model.js';
import { getConfig } from '../../config/abacatepay.js';
import * as abacatepay from './abacatepay.service.js';
import paymentSettingsService from './payment-settings.service.js';
import registry from './providers/index.js';

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Recorte público de um Payment (sem campos internos) — devolvido pela tela
// de checkout e pelo gate de billing.
function publicPayment(payment) {
  if (!payment) return null;
  return {
    id: payment._id,
    provider: payment.provider,
    amount: payment.amount,
    status: payment.status,
    checkoutUrl: payment.checkoutUrl || null,
    pix: payment.pix || null,
    createdAt: payment.createdAt
  };
}

class SubscriptionService {
  // ─── Sincronização com o AbacatePay ────────────────────────────────────────

  /**
   * Garante que o plano tenha um Product recorrente no AbacatePay.
   * Chamado ao criar/editar o plano (admin). `recreate` força um novo produto
   * (a API v2 não tem update de produto — preço/ciclo novos = produto novo).
   * @returns {Promise<object>} plano atualizado (com abacateProductId)
   */
  async ensurePlanProduct(plan, { recreate = false } = {}) {
    if (plan.abacateProductId && !recreate) return plan;

    const priceCents = Math.round(Number(plan.price || 0) * 100);
    if (priceCents <= 0) throw httpError('Plano sem preço configurado', 422);

    const externalId = `plan-${plan._id}-${Date.now()}`;
    const product = await abacatepay.createProduct({
      externalId,
      name: plan.name,
      price: priceCents,
      cycle: plan.cycle || 'MONTHLY',
      description: (plan.description || '').slice(0, 140) || undefined
    });
    if (!product?.id) throw httpError('AbacatePay não retornou o ID do produto', 502);

    const updated = await planRepository.update(plan._id, {
      abacateProductId: product.id,
      abacateProductExternalId: externalId
    });
    logger.info(`Billing :: produto AbacatePay ${product.id} vinculado ao plano ${plan._id}`);
    return updated;
  }

  /**
   * Cria/sincroniza o Customer da empresa no AbacatePay (best-effort).
   * @returns {Promise<string|null>} abacateCustomerId ou null se não foi possível
   */
  async ensureCompanyCustomer(company, payer = {}) {
    if (company.abacateCustomerId) return company.abacateCustomerId;

    try {
      const customer = await abacatepay.createCustomer({
        name: payer.name || company.name,
        email: payer.email || company.email,
        cellphone: payer.phone || company.phone,
        taxId: payer.taxId || company.document
      });
      if (customer?.id) {
        await companyRepository.update(company._id, { abacateCustomerId: customer.id });
        logger.info(`Billing :: customer AbacatePay ${customer.id} vinculado à empresa ${company._id}`);
        return customer.id;
      }
    } catch (err) {
      // Sem customer válido (ex.: CPF inválido), o AbacatePay coleta na página.
      logger.warn(`Billing :: customer não criado p/ empresa ${company._id}: ${err.message}`);
    }
    return null;
  }

  // ─── Checkout de assinatura ────────────────────────────────────────────────

  /**
   * Cria o checkout de ASSINATURA recorrente do plano da empresa e persiste um
   * Payment local. Retorna a `url` hospedada (AbacatePay) para o 1º pagamento.
   * @param {object} p
   * @param {string} p.companyId
   * @param {string} [p.planId] plano a assinar; default = company.planId
   * @param {object} [p.payer] dados do pagador p/ o customer (name,email,phone,taxId)
   * @returns {Promise<{paymentId,url,amount,status,providerBillingId,moduleCodes,planId}>}
   */
  async createCheckout({ companyId, planId, payer, completionUrl, returnUrl, method }) {
    if (!companyId) throw httpError('companyId é obrigatório', 422);

    const company = await companyRepository.findById(companyId);
    if (!company) throw httpError('Empresa não encontrada', 404);

    const effectivePlanId = planId || company.planId;
    if (!effectivePlanId) throw httpError('Empresa não tem plano para assinar', 422);

    let plan = await planRepository.findById(effectivePlanId);
    if (!plan) throw httpError('Plano não encontrado', 404);
    if (!plan.isActive) throw httpError('Plano inativo', 422);

    // Roteamento método→provedor. Sem `method`, usa a rota padrão (cartão via
    // AbacatePay — comportamento atual). PIX é roteado para o Itaú.
    const route = method
      ? await paymentSettingsService.resolveForMethod(method)
      : await paymentSettingsService.defaultRoute();

    if (route.providerKey === 'itau') {
      return this._createItauCheckout({ company, plan, route });
    }
    if (route.providerKey !== 'abacatepay') {
      throw httpError(`Provedor ${route.providerKey} ainda não implementado no billing`, 422);
    }

    // Garante o produto recorrente no AbacatePay (cria sob demanda se faltar).
    plan = await this.ensurePlanProduct(plan);

    const codes = [...plan.moduleCodes];
    const periodDays = cycleToDays(plan.cycle);

    await this._ensureModulesAttached(company, codes);

    // Sincroniza o cliente no AbacatePay (best-effort).
    const customerId = await this.ensureCompanyCustomer(company, payer || {});

    const cfg = getConfig();
    const externalId = String(companyId); // devolvido como data.payment.externalId

    const sub = await abacatepay.createSubscription({
      items: [{ id: plan.abacateProductId, quantity: 1 }],
      customerId: customerId || undefined,
      externalId,
      completionUrl: completionUrl || cfg.successUrl,
      returnUrl: returnUrl || cfg.cancelUrl,
      // Assinatura recorrente exige cartão (PIX Automático não é habilitado por padrão).
      methods: ['CARD']
    });
    if (!sub?.id) throw httpError('AbacatePay não retornou o ID da assinatura', 502);

    const amount = (sub.amount != null ? sub.amount : Math.round(Number(plan.price || 0) * 100)) / 100;

    const payment = await paymentRepository.create({
      companyId,
      planId: plan._id,
      provider: 'abacatepay',
      providerBillingId: sub.id,
      kind: 'subscription',
      abacateCustomerId: customerId || undefined,
      amount,
      moduleCodes: codes,
      periodDays,
      status: 'pending',
      checkoutUrl: sub.url,
      metadata: { providerStatus: sub.status, externalId, abacateProductId: plan.abacateProductId }
    });

    logger.info(`Billing :: assinatura ${sub.id} criada p/ empresa ${companyId} (plano ${plan.name})`);

    return {
      paymentId: payment._id,
      url: payment.checkoutUrl,
      amount: payment.amount,
      status: payment.status,
      providerBillingId: sub.id,
      moduleCodes: codes,
      planId: plan._id
    };
  }

  // ─── Checkout via Itaú (Pix) ──────────────────────────────────────────────

  /**
   * Cria uma cobrança Pix no Itaú para a assinatura do plano e persiste o
   * Payment local. Retorna { paymentId, pix, amount, status, ... }.
   * Diferente do AbacatePay, não há página hospedada — o front exibe o QR.
   */
  async _createItauCheckout({ company, plan, route }) {
    const codes = [...plan.moduleCodes];
    const periodDays = cycleToDays(plan.cycle);
    await this._ensureModulesAttached(company, codes);

    const provider = registry.get('itau');
    const charge = await provider.createCharge(
      {
        companyId: String(company._id),
        planId: String(plan._id),
        amount: Number(plan.price || 0),
        method: 'pix',
        periodDays,
        moduleCodes: codes,
        recurring: !!route.recurring,
        payer: {
          name: company.name,
          email: company.email,
          phone: company.phone,
          taxId: company.document
        }
      },
      route.config
    );

    const payment = await paymentRepository.create({
      companyId: company._id,
      planId: plan._id,
      provider: 'itau',
      providerBillingId: charge.providerBillingId,
      kind: 'subscription',
      amount: charge.amount,
      moduleCodes: codes,
      periodDays,
      status: charge.status || 'pending',
      pix: charge.pix,
      metadata: { environment: route.config?.environment, recurring: !!route.recurring }
    });

    logger.info(`Billing :: cobrança Itaú ${charge.providerBillingId} criada p/ empresa ${company._id} (plano ${plan.name})`);

    return {
      paymentId: payment._id,
      provider: 'itau',
      pix: payment.pix,
      amount: payment.amount,
      status: payment.status,
      providerBillingId: payment.providerBillingId,
      moduleCodes: codes,
      planId: plan._id
    };
  }

  /** Webhook do Itaú (billing). Idempotente pelo providerBillingId. */
  async handleItauWebhook(event) {
    if (!event?.providerBillingId) {
      logger.warn('Billing :: webhook Itaú sem providerBillingId');
      return null;
    }
    const payment = await paymentRepository.findByProviderBillingId(event.providerBillingId);
    if (!payment) {
      logger.warn(`Billing :: webhook Itaú para cobrança desconhecida ${event.providerBillingId}`);
      return null;
    }
    await paymentRepository.pushEvent(payment._id, { type: `itau.${event.status}`, raw: event.raw });

    if (event.status !== 'paid') {
      if (payment.status === 'pending') {
        await paymentRepository.update(payment._id, {
          status: event.status === 'expired' ? 'expired' : 'cancelled'
        });
      }
      return payment;
    }

    if (payment.status === 'paid') return payment;

    const paidAt = new Date();
    await paymentRepository.markPaid(payment._id, { paidAt });
    await this.activateSubscription(payment, paidAt);
    logger.info(`Billing :: cobrança Itaú ${event.providerBillingId} paga → assinatura liberada (empresa ${payment.companyId})`);
    return payment;
  }

  async _ensureModulesAttached(company, codes) {
    const missing = codes.filter(c => !company.modules.some(m => m.code === c));
    if (!missing.length) return;

    const modules = await moduleRepository.findByCodes(missing);
    for (const code of missing) {
      const mod = modules.find(m => m.code === code);
      if (!mod) {
        logger.warn(`Billing :: módulo ${code} inexistente; não vinculado à empresa ${company._id}`);
        continue;
      }
      await companyRepository.addModule(company._id, {
        moduleId: mod._id,
        code: mod.code,
        subscriptionStatus: 'pending'
      });
    }
  }

  // ─── Webhook ────────────────────────────────────────────────────────────────

  /** Ponto de entrada do webhook: roteia por tipo de evento. */
  async handleWebhookEvent(body) {
    const event = body?.event;
    if (event === 'subscription.completed' || event === 'subscription.renewed' || event === 'subscription.trial_started') {
      return this.handleSubscriptionEvent({ event, body });
    }
    // Legado (checkout avulso v2 / billing v1)
    if (event === 'checkout.completed' || event === 'billing.paid') {
      const checkout = body?.data?.checkout || body?.data?.billing;
      if (checkout?.id && (!checkout.status || checkout.status === 'PAID')) {
        return this.handlePaidEvent({ providerBillingId: checkout.id, rawEvent: body });
      }
      return null;
    }
    logger.info(`Billing :: webhook ignorado (event=${event})`);
    return null;
  }

  /**
   * Processa eventos de assinatura. `completed`/`trial_started` ativam; `renewed`
   * estende o período. Idempotente pelo id do evento (log_...).
   */
  async handleSubscriptionEvent({ event, body }) {
    const data = body?.data || {};
    const subscriptionId = data.subscription?.id;
    const externalId = data.payment?.externalId;
    const billId = data.payment?.id;
    const eventLogId = body?.id;

    const payment = await paymentRepository.findByAnyRef({ subscriptionId, externalId, providerBillingId: billId });
    if (!payment) {
      logger.warn(`Billing :: webhook ${event} sem cobrança correspondente (sub=${subscriptionId}, ext=${externalId})`);
      return null;
    }

    // Idempotência: ignora reentrega do mesmo evento.
    if (eventLogId && (payment.events || []).some(e => e?.raw?.id === eventLogId)) {
      logger.info(`Billing :: evento ${eventLogId} já processado (idempotente)`);
      return payment;
    }
    await paymentRepository.pushEvent(payment._id, { type: event, raw: body });

    // Vincula a assinatura à empresa/cobrança na primeira vez.
    if (subscriptionId && payment.abacateSubscriptionId !== subscriptionId) {
      await paymentRepository.update(payment._id, { abacateSubscriptionId: subscriptionId });
      await companyRepository.update(payment.companyId, { abacateSubscriptionId: subscriptionId });
    }

    const paidAt = new Date();
    if (payment.status !== 'paid') {
      await paymentRepository.markPaid(payment._id, { paidAt });
    }
    await this.activateSubscription(payment, paidAt);

    logger.info(`Billing :: ${event} processado → assinatura liberada/renovada (empresa ${payment.companyId})`);
    return payment;
  }

  /** Caminho legado (cobrança avulsa). Idempotente. */
  async handlePaidEvent({ providerBillingId, rawEvent }) {
    const payment = await paymentRepository.findByProviderBillingId(providerBillingId);
    if (!payment) {
      logger.warn(`Billing :: webhook 'paid' para cobrança desconhecida ${providerBillingId}`);
      return null;
    }
    await paymentRepository.pushEvent(payment._id, { type: rawEvent?.event, raw: rawEvent });
    if (payment.status === 'paid') return payment;

    const paidAt = new Date();
    await paymentRepository.markPaid(payment._id, { paidAt });
    await this.activateSubscription(payment, paidAt);
    return payment;
  }

  /**
   * Libera a assinatura: ativa a empresa e cada módulo por +periodDays.
   * Renovações estendem a partir do expiresAt vigente (acumula).
   */
  async activateSubscription(payment, paidAt = new Date()) {
    const company = await companyRepository.findById(payment.companyId);
    if (!company) {
      logger.error(`Billing :: empresa ${payment.companyId} não encontrada ao ativar assinatura`);
      return;
    }

    if (company.status !== 'active') {
      await companyRepository.setStatus(company._id, 'active');
    }

    for (const code of payment.moduleCodes) {
      const mod = company.modules.find(m => m.code === code);
      if (!mod) {
        logger.warn(`Billing :: módulo ${code} não vinculado à empresa ${company._id}; ativação ignorada`);
        continue;
      }
      const base = (mod.expiresAt && new Date(mod.expiresAt) > paidAt) ? new Date(mod.expiresAt) : paidAt;
      const expiresAt = addDays(base, payment.periodDays || 30);
      await companyRepository.setModuleSubscription(company._id, code, {
        subscriptionStatus: 'active',
        activatedAt: paidAt,
        expiresAt
      });
    }
  }

  async getPayment(id) {
    return await paymentRepository.findById(id);
  }

  // ─── Gate de billing (trial/assinatura vencidos) ───────────────────────────

  /**
   * Status de cobrança da empresa: bloqueado quando não é isenta e não tem
   * nenhum módulo ativo (trial expirado ou assinatura vencida sem renovação).
   * Quando bloqueado, garante (cria se preciso) a cobrança pendente atual —
   * usado tanto pela tela de checkout quanto pelo gate de escrita da API.
   */
  async getBillingStatus(companyId) {
    const company = await companyRepository.findById(companyId);
    if (!company) return { blocked: false };
    if (company.subscriptionExempt) return { blocked: false, exempt: true };

    if (company.activeModuleCodes().length > 0) {
      return { blocked: false, trialEndsAt: company.trialEndsAt || null };
    }

    const payment = await this.ensureChargeForCompany(company);
    const trialExpired = company.trialEndsAt && new Date(company.trialEndsAt) <= new Date();
    return {
      blocked: true,
      reason: trialExpired ? 'trial_expired' : 'subscription_expired',
      trialEndsAt: company.trialEndsAt || null,
      payment: publicPayment(payment)
    };
  }

  /**
   * Garante uma cobrança em aberto para a empresa: reaproveita a pendente mais
   * recente ou cria uma nova (Pix por padrão; cai na rota padrão de pagamento
   * se o Pix não estiver configurado). Idempotente — não duplica cobrança
   * enquanto a anterior seguir pendente. Usado pelo gate de billing e pelo
   * job de expiração de trial.
   */
  async ensureChargeForCompany(company) {
    const pending = await paymentRepository.findLatestPendingForCompany(company._id);
    if (pending) return pending;

    try {
      const result = await this.createCheckout({ companyId: company._id, method: 'pix' });
      return await paymentRepository.findById(result.paymentId);
    } catch (err) {
      logger.warn(`Billing :: Pix indisponível p/ empresa ${company._id} (${err.message}); tentando rota padrão`);
    }

    try {
      const result = await this.createCheckout({ companyId: company._id });
      return await paymentRepository.findById(result.paymentId);
    } catch (err) {
      logger.warn(`Billing :: falha ao gerar cobrança automática p/ empresa ${company._id}: ${err.message}`);
      return null;
    }
  }
}

export default new SubscriptionService();
