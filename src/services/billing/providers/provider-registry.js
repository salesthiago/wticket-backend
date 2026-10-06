import logger from '../../../utils/logger.js';

class PaymentProviderRegistry {
  constructor() {
    this._byKey = new Map();
  }

  register(provider) {
    if (!provider?.key) throw new Error('provider inválido: falta key');
    this._byKey.set(provider.key, provider);
    logger.info(`Billing :: provedor de pagamento registrado: ${provider.key}`);
    return this;
  }

  get(key) {
    const provider = this._byKey.get(key);
    if (!provider) {
      throw Object.assign(new Error(`Provedor de pagamento não registrado: ${key}`), { status: 500 });
    }
    return provider;
  }

  has(key) {
    return this._byKey.has(key);
  }

  list() {
    return [...this._byKey.values()];
  }

  /** Provedores que conseguem processar o método informado. */
  supporting(method) {
    return this.list().filter(p => p.supportedMethods.includes(method));
  }
}

export default new PaymentProviderRegistry();
