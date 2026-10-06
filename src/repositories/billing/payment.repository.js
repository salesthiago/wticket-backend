import Payment from '../../models/billing/payment.model.js';

class PaymentRepository {
  async create(data) {
    const created = new Payment(data);
    return await created.save();
  }

  async findById(id) {
    return await Payment.findById(id);
  }

  async findByProviderBillingId(providerBillingId) {
    if (!providerBillingId) return null;
    return await Payment.findOne({ providerBillingId });
  }

  // Resolve a cobrança a partir de qualquer identificador do webhook de assinatura
  // (subscription.completed traz subscriptionId/externalId; renewed traz subscriptionId).
  async findByAnyRef({ subscriptionId, providerBillingId, externalId } = {}) {
    const or = [];
    if (subscriptionId) or.push({ abacateSubscriptionId: subscriptionId });
    if (providerBillingId) or.push({ providerBillingId });
    if (externalId) or.push({ 'metadata.externalId': externalId });
    if (!or.length) return null;
    return await Payment.findOne({ $or: or }).sort({ createdAt: -1 });
  }

  async findByCompany(companyId, { limit = 50 } = {}) {
    return await Payment.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  // Cobrança em aberto mais recente (usada pelo gate de billing e pelo job de
  // expiração de trial p/ evitar duplicar cobrança enquanto a anterior
  // seguir pendente).
  async findLatestPendingForCompany(companyId) {
    return await Payment.findOne({ companyId, status: 'pending' }).sort({ createdAt: -1 });
  }

  async update(id, data) {
    return await Payment.findByIdAndUpdate(
      id,
      { $set: { ...data } },
      { new: true }
    );
  }

  async markPaid(id, { paidAt = new Date() } = {}) {
    return await Payment.findByIdAndUpdate(
      id,
      { $set: { status: 'paid', paidAt } },
      { new: true }
    );
  }

  async pushEvent(id, event) {
    return await Payment.findByIdAndUpdate(
      id,
      { $push: { events: event } },
      { new: true }
    );
  }
}

export default new PaymentRepository();
