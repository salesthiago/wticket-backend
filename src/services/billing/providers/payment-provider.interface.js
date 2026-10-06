// Contrato comum dos provedores de pagamento do billing.
//
// Cada provedor (abacatepay, itau, stripe) implementa este shape e é registrado
// no provider-registry. O subscription.service resolve o provedor pelo método
// escolhido (mapa de roteamento em PaymentSettings) e chama createCharge/parseWebhook.
//
// interface PaymentProvider {
//   key: 'abacatepay' | 'itau' | 'stripe'
//   supportedMethods: Array<'pix' | 'credit_card' | 'debit_card'>
//   supportsRecurring: boolean
//   isConfigured(config): boolean
//   createCharge(request, config): Promise<ChargeResult>
//   parseWebhook(rawBody, headers, query, config): WebhookEvent
// }
//
// ChargeRequest {
//   companyId, planId, amount (BRL), method, periodDays,
//   moduleCodes: string[], recurring: boolean,
//   payer: { name, email, phone, taxId },
//   completionUrl, returnUrl
// }
//
// ChargeResult {
//   provider, providerBillingId,
//   checkoutUrl?,                 // fluxos hospedados (AbacatePay)
//   pix?: { qrCode, copyPaste, txid, expiresAt },  // Itaú
//   clientSecret?, redirectUrl?,  // fluxos client-side (Stripe, futuro)
//   amount, status, raw
// }
//
// WebhookEvent {
//   providerBillingId, status: 'paid' | 'expired' | 'cancelled', raw
// }

export const PAYMENT_PROVIDER_KEYS = ['abacatepay', 'itau', 'stripe'];
export const BILLING_PAYMENT_METHODS = ['pix', 'credit_card', 'debit_card'];
