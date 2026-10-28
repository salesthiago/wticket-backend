import logger from '../../utils/logger.js';
import Company from '../../models/company.model.js';
import companyRepository from '../../repositories/company.repository.js';
import planRepository from '../../repositories/plan.repository.js';
import paymentRepository from '../../repositories/billing/payment.repository.js';
import { cycleToDays } from '../../models/plan.model.js';
import subscriptionService from './subscription.service.js';

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Métodos aceitos ao gerar cobrança pelo painel: os dois primeiros passam pelo
// roteamento normal de provedores (PaymentSettings); 'manual' só registra.
export const CHARGE_METHODS = ['pix', 'boleto', 'credit_card', 'manual'];

/**
 * Financeiro da PLATAFORMA (super_admin): situação de cobrança de cada empresa
 * assinante, geração de cobranças, baixa manual, cancelamento e estorno.
 */
class PlatformBillingService {
  /**
   * Situação de cada empresa:
   *   exempt    → isenta de assinatura
   *   trial     → em período de teste (trialEndsAt futuro, nada pago ainda)
   *   up_to_date→ tem módulo com assinatura ativa e não vencida
   *   overdue   → sem módulo ativo (trial/assinatura vencidos)
   *   cancelled → empresa cancelada
   * `nextChargeAt` = quando o acesso atual acaba (menor expiresAt dos módulos
   * ativos, ou fim do trial) — é a data em que a próxima cobrança vence.
   */
  async overview() {
    const now = new Date();
    const [companies, lastPaid, pending] = await Promise.all([
      Company.find({}, {
        name: 1, document: 1, email: 1, phone: 1, status: 1, planId: 1, modules: 1,
        trialEndsAt: 1, subscriptionExempt: 1, createdAt: 1
      }).populate('planId', 'name price cycle').sort({ name: 1 }),
      paymentRepository.aggregate([
        { $match: { status: 'paid' } },
        { $sort: { paidAt: -1 } },
        { $group: { _id: '$companyId', paidAt: { $first: '$paidAt' }, amount: { $first: '$amount' } } }
      ]),
      paymentRepository.aggregate([
        { $match: { status: 'pending' } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$companyId', id: { $first: '$_id' }, amount: { $first: '$amount' }, createdAt: { $first: '$createdAt' }, dueDate: { $first: '$dueDate' }, count: { $sum: 1 } } }
      ])
    ]);

    const lastPaidMap = new Map(lastPaid.map(p => [String(p._id), p]));
    const pendingMap = new Map(pending.map(p => [String(p._id), p]));

    const rows = companies.map(c => {
      const activeModules = c.modules.filter(m =>
        m.subscriptionStatus === 'active' && (!m.expiresAt || m.expiresAt > now)
      );
      const expirations = activeModules.map(m => m.expiresAt).filter(Boolean).map(d => new Date(d));
      const paid = lastPaidMap.get(String(c._id)) || null;
      const trialActive = !!(c.trialEndsAt && new Date(c.trialEndsAt) > now);

      let situation;
      if (c.status === 'cancelled') situation = 'cancelled';
      else if (c.subscriptionExempt) situation = 'exempt';
      else if (trialActive && !paid) situation = 'trial';
      else if (activeModules.length) situation = 'up_to_date';
      else situation = 'overdue';

      let nextChargeAt = null;
      if (situation === 'up_to_date' && expirations.length) {
        nextChargeAt = new Date(Math.min(...expirations.map(d => d.getTime())));
      } else if (situation === 'trial') {
        nextChargeAt = c.trialEndsAt;
      }

      const plan = c.planId && typeof c.planId === 'object' ? c.planId : null;
      return {
        _id: c._id,
        name: c.name,
        document: c.document,
        email: c.email,
        phone: c.phone,
        status: c.status,
        createdAt: c.createdAt,
        plan: plan ? { _id: plan._id, name: plan.name, price: plan.price, cycle: plan.cycle } : null,
        situation,
        nextChargeAt,
        trialEndsAt: c.trialEndsAt || null,
        lastPayment: paid ? { paidAt: paid.paidAt, amount: paid.amount } : null,
        pendingPayment: pendingMap.get(String(c._id)) || null
      };
    });

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [receivedThisMonth, refundedThisMonth] = await Promise.all([
      paymentRepository.aggregate([
        { $match: { status: { $in: ['paid', 'refunded'] }, paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      paymentRepository.aggregate([
        { $match: { status: 'refunded', refundedAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const count = (s) => rows.filter(r => r.situation === s).length;
    const in7Days = addDays(now, 7);
    return {
      summary: {
        upToDate: count('up_to_date'),
        overdue: count('overdue'),
        trial: count('trial'),
        exempt: count('exempt'),
        dueIn7Days: rows.filter(r => r.nextChargeAt && new Date(r.nextChargeAt) <= in7Days).length,
        pendingAmount: pending.reduce((sum, p) => sum + (p.amount || 0), 0),
        receivedThisMonth: receivedThisMonth[0]?.total || 0,
        refundedThisMonth: refundedThisMonth[0]?.total || 0
      },
      companies: rows
    };
  }

  async listPayments({ companyId, status, provider } = {}) {
    const query = {};
    if (companyId) query.companyId = companyId;
    if (status) query.status = status;
    if (provider) query.provider = provider;
    return await paymentRepository.findAll(query);
  }

  /**
   * Gera uma cobrança para a empresa. Pix/cartão reaproveitam o checkout da
   * assinatura (mesmo fluxo que a própria empresa usa); 'manual' cria só o
   * registro, a ser baixado no painel quando o pagamento chegar.
   */
  async createCharge({ companyId, method, amount, dueDate, description, userId }) {
    if (!CHARGE_METHODS.includes(method)) throw httpError('Forma de cobrança inválida', 422);

    const company = await companyRepository.findById(companyId);
    if (!company) throw httpError('Empresa não encontrada', 404);

    if (method !== 'manual') {
      // Boleto já nasce com o vencimento informado; nos demais só fica registrado.
      const result = await subscriptionService.createCheckout({ companyId, method, dueDate });
      const updates = { createdBy: userId };
      if (dueDate) updates.dueDate = dueDate;
      if (description) updates.description = description;
      await paymentRepository.update(result.paymentId, updates);
      return await paymentRepository.findById(result.paymentId);
    }

    const plan = company.planId ? await planRepository.findById(company.planId) : null;
    const value = amount !== undefined && amount !== null && amount !== '' ? Number(amount) : Number(plan?.price || 0);
    if (!Number.isFinite(value) || value <= 0) throw httpError('Informe um valor maior que zero', 422);

    // Sem plano, a baixa libera os módulos que a empresa já tem vinculados.
    const moduleCodes = plan?.moduleCodes?.length ? [...plan.moduleCodes] : company.modules.map(m => m.code);
    if (plan) await subscriptionService._ensureModulesAttached(company, moduleCodes);

    const payment = await paymentRepository.create({
      companyId,
      planId: plan?._id,
      provider: 'manual',
      kind: 'manual',
      amount: value,
      moduleCodes,
      periodDays: cycleToDays(plan?.cycle),
      status: 'pending',
      description: description || (plan ? `Assinatura ${plan.name}` : 'Cobrança avulsa'),
      dueDate: dueDate || undefined,
      createdBy: userId,
      customer: { name: company.name, email: company.email, phone: company.phone, taxId: company.document }
    });
    logger.info(`Platform billing :: cobrança manual ${payment._id} criada p/ empresa ${companyId}`);
    return payment;
  }

  /** Baixa manual: marca como paga e libera/renova a assinatura. */
  async markPaid(id, { paidAt, userId } = {}) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw httpError('Cobrança não encontrada', 404);
    if (payment.status !== 'pending' && payment.status !== 'expired') {
      throw httpError('Só é possível dar baixa em cobranças pendentes ou expiradas', 422);
    }
    const when = paidAt ? new Date(paidAt) : new Date();
    await paymentRepository.markPaid(payment._id, { paidAt: when });
    await paymentRepository.pushEvent(payment._id, { type: 'manual.paid', raw: { userId, paidAt: when } });
    await subscriptionService.activateSubscription(payment, when);
    return await paymentRepository.findById(payment._id);
  }

  async cancel(id, { userId } = {}) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw httpError('Cobrança não encontrada', 404);
    if (payment.status !== 'pending') throw httpError('Só é possível cancelar cobranças pendentes', 422);
    await paymentRepository.update(payment._id, { status: 'cancelled' });
    await paymentRepository.pushEvent(payment._id, { type: 'manual.cancelled', raw: { userId } });
    return await paymentRepository.findById(payment._id);
  }

  /**
   * Estorno: marca a cobrança paga como 'refunded' e, se `revokeAccess`,
   * devolve os dias concedidos (subtrai periodDays do expiresAt de cada
   * módulo). Módulos que ficarem vencidos passam a 'expired'.
   */
  async refund(id, { reason, revokeAccess = true, userId } = {}) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw httpError('Cobrança não encontrada', 404);
    if (payment.status !== 'paid') throw httpError('Só é possível estornar cobranças pagas', 422);
    if (!reason || !String(reason).trim()) throw httpError('Informe o motivo do estorno', 422);

    if (revokeAccess) {
      const company = await companyRepository.findById(payment.companyId);
      const now = new Date();
      for (const code of payment.moduleCodes || []) {
        const mod = company?.modules.find(m => m.code === code);
        if (!mod?.expiresAt) continue;
        const expiresAt = addDays(mod.expiresAt, -(payment.periodDays || 30));
        const patch = { expiresAt };
        if (expiresAt <= now) patch.subscriptionStatus = 'expired';
        await companyRepository.setModuleSubscription(company._id, code, patch);
      }
    }

    await paymentRepository.update(payment._id, {
      status: 'refunded',
      refundedAt: new Date(),
      refundReason: String(reason).trim(),
      refundedBy: userId,
      accessRevoked: !!revokeAccess
    });
    await paymentRepository.pushEvent(payment._id, { type: 'manual.refunded', raw: { userId, reason, revokeAccess } });
    logger.info(`Platform billing :: cobrança ${payment._id} estornada (revokeAccess=${!!revokeAccess})`);
    return await paymentRepository.findById(payment._id);
  }
}

export default new PlatformBillingService();
