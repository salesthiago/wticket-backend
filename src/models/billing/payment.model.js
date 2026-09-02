import mongoose from 'mongoose';

export const PAYMENT_STATUS = ['pending', 'paid', 'expired', 'cancelled', 'refunded'];

// Auditoria dos eventos de webhook recebidos para esta cobrança.
const WebhookEventSchema = new mongoose.Schema({
  type: { type: String },
  receivedAt: { type: Date, default: Date.now },
  raw: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const CustomerSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  taxId: { type: String, trim: true }
}, { _id: false });

// Dados da cobrança Pix (provider 'itau'). Não há página hospedada — o front
// exibe o QR / copia-e-cola.
const PixSchema = new mongoose.Schema({
  qrCode: { type: String, trim: true },
  copyPaste: { type: String, trim: true },
  txid: { type: String, trim: true },
  expiresAt: { type: Date }
}, { _id: false });

// Representa uma cobrança gerada num provedor de pagamento (hoje: AbacatePay)
// para liberar a assinatura dos módulos de uma empresa. Serve de elo entre a
// cobrança externa e a ativação interna, garantindo idempotência no webhook.
const PaymentSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  // Plano que originou a cobrança (quando paga por plano, não por módulos avulsos).
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  provider: { type: String, enum: ['abacatepay', 'itau', 'stripe'], default: 'abacatepay', index: true },
  // ID da cobrança no provedor (ex.: bill_xxxx). Único quando preenchido
  // (índice unique+sparse declarado abaixo via schema.index).
  providerBillingId: { type: String },
  // Assinatura recorrente no AbacatePay (subs_...). Renovações chegam por este id.
  abacateSubscriptionId: { type: String, trim: true, index: true },
  abacateCustomerId: { type: String, trim: true },
  kind: { type: String, enum: ['billing', 'pixQrCode', 'subscription'], default: 'billing' },
  // Valor total em BRL (reais), já convertido dos centavos do provedor.
  amount: { type: Number, default: 0, min: 0 },
  // Códigos dos módulos que esta cobrança libera ao ser paga.
  moduleCodes: { type: [String], default: [] },
  // Dias de validade concedidos a cada módulo no pagamento (assinatura mensal).
  periodDays: { type: Number, default: 30 },
  status: { type: String, enum: PAYMENT_STATUS, default: 'pending', index: true },
  // Link hospedado de checkout (AbacatePay) para onde o cliente é enviado.
  checkoutUrl: { type: String, trim: true },
  customer: { type: CustomerSchema, default: {} },
  // Preenchido quando provider === 'itau'.
  pix: { type: PixSchema, default: null },
  paidAt: { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  events: { type: [WebhookEventSchema], default: [] }
}, { timestamps: true });

PaymentSchema.index({ providerBillingId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model('Payment', PaymentSchema);
