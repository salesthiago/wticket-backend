// Contrato comum dos provedores de pagamento do billing.
//
// Cada provedor (abacatepay, itau, inter, stripe) implementa este shape e é registrado
// no provider-registry. O subscription.service resolve o provedor pelo método
// escolhido (mapa de roteamento em PaymentSettings) e chama createCharge/parseWebhook.
//
// interface PaymentProvider {
//   key: 'abacatepay' | 'itau' | 'inter' | 'stripe'
//   supportedMethods: Array<'pix' | 'boleto' | 'credit_card' | 'debit_card'>
//   supportsRecurring: boolean
//   isConfigured(config): boolean
//   createCharge(request, config): Promise<ChargeResult>
//   parseWebhook(rawBody, headers, query, config): WebhookEvent
// }
//
// ChargeRequest {
//   companyId, planId, amount (BRL), method, periodDays,
//   moduleCodes: string[], recurring: boolean,
//   dueDate?,                     // vencimento do boleto (Inter); default = config
//   payer: { name, email, phone, taxId },
//   completionUrl, returnUrl
// }
//
// ChargeResult {
//   provider, providerBillingId,
//   checkoutUrl?,                 // fluxos hospedados (AbacatePay)
//   pix?: { qrCode, copyPaste, txid, expiresAt },  // Itaú / Inter
//   boleto?: { codigoSolicitacao, seuNumero, nossoNumero, linhaDigitavel, codigoBarras, dueDate },  // Inter
//   clientSecret?, redirectUrl?,  // fluxos client-side (Stripe, futuro)
//   amount, status, raw
// }
//
// WebhookEvent {
//   providerBillingId, status: 'paid' | 'expired' | 'cancelled', raw
// }
// (o Inter devolve WebhookEvent[] — agrupa várias cobranças por POST)

export const PAYMENT_PROVIDER_KEYS = ['abacatepay', 'itau', 'inter', 'stripe'];
export const BILLING_PAYMENT_METHODS = ['pix', 'boleto', 'credit_card', 'debit_card'];
