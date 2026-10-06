import PaymentSettings, {
  PAYMENT_PROVIDER_KEYS,
  BILLING_PAYMENT_METHODS
} from '../../models/billing/payment-settings.model.js';

// Roteamento padrão: cartão pelo AbacatePay (comportamento atual), PIX pelo
// Itaú (desabilitado até configurar).
const DEFAULT_METHOD_ROUTES = [
  { method: 'pix', enabled: false, providerKey: 'itau' },
  { method: 'credit_card', enabled: true, providerKey: 'abacatepay' },
  { method: 'debit_card', enabled: false, providerKey: 'abacatepay' }
];

class PaymentSettingsRepository {
  async getOrCreate() {
    let doc = await PaymentSettings.findOne({ singleton: 'billing' });
    if (!doc) {
      doc = await PaymentSettings.create({ singleton: 'billing', methods: DEFAULT_METHOD_ROUTES });
    } else if (!doc.methods || doc.methods.length === 0) {
      doc.methods = DEFAULT_METHOD_ROUTES;
      await doc.save();
    }
    return doc;
  }

  async setMethods(methods) {
    const doc = await this.getOrCreate();
    doc.methods = methods;
    await doc.save();
    return doc;
  }

  async patchProvider(providerKey, patch, updatedBy) {
    const doc = await this.getOrCreate();
    Object.assign(doc[providerKey], patch);
    if (updatedBy) doc.updatedBy = updatedBy;
    await doc.save();
    return doc;
  }

  async setItauCertificate(certificate) {
    const doc = await this.getOrCreate();
    doc.itau.certificate = certificate;
    await doc.save();
    return doc;
  }

  async setItauPrivateKey(privateKey) {
    const doc = await this.getOrCreate();
    doc.itau.privateKey = privateKey;
    await doc.save();
    return doc;
  }
}

export { DEFAULT_METHOD_ROUTES, PAYMENT_PROVIDER_KEYS, BILLING_PAYMENT_METHODS };
export default new PaymentSettingsRepository();
