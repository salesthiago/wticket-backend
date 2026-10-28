import registry from './provider-registry.js';
import abacatepayProvider from './abacatepay.provider.js';
import itauProvider from './itau.provider.js';
import interProvider from './inter.provider.js';
import stripeProvider from './stripe.provider.js';

// Registra todos os provedores de pagamento uma única vez, no import.
registry
  .register(abacatepayProvider)
  .register(itauProvider)
  .register(interProvider)
  .register(stripeProvider);

export default registry;
export { registry };
