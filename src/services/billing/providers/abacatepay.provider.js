import { isConfigured as abacatepayConfigured } from '../../../config/abacatepay.js';

// Adaptador do AbacatePay para a interface de provedores.
//
// O fluxo de checkout do AbacatePay (Product recorrente + Subscription + página
// hospedada) continua sendo executado INLINE pelo subscription.service, que é o
// código já testado em produção. Este adaptador serve só para o registry / a
// tela admin enxergarem o AbacatePay como provedor e para o roteamento
// método→provedor. `createCharge` sinaliza que o caminho é o legado inline.

export const abacatepayProvider = {
  key: 'abacatepay',
  supportedMethods: ['credit_card', 'debit_card'],
  supportsRecurring: true,

  isConfigured() {
    return abacatepayConfigured();
  },

  async createCharge() {
    throw Object.assign(
      new Error('AbacatePay é processado pelo fluxo inline do subscription.service'),
      { code: 'HANDLED_INLINE' }
    );
  }
};

export default abacatepayProvider;
