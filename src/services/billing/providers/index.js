import registry from './provider-registry.js';
import abacatepayProvider from './abacatepay.provider.js';
import itauProvider from './itau.provider.js';

// Registra todos os provedores de pagamento uma única vez, no import.
registry
  .register(abacatepayProvider)
  .register(itauProvider);

export default registry;
export { registry };
