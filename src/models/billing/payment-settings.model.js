import mongoose from 'mongoose';

// Chaves dos provedores de pagamento suportados pelo billing.
export const PAYMENT_PROVIDER_KEYS = ['abacatepay', 'itau', 'stripe'];

// Métodos de pagamento oferecidos. 'pix' vai pelo Itaú; cartão pelo AbacatePay
// (hoje) ou Stripe (futuro).
export const BILLING_PAYMENT_METHODS = ['pix', 'credit_card', 'debit_card'];

// Um método habilitável + qual provedor o processa (mapa de roteamento).
const MethodRouteSchema = new mongoose.Schema({
  method: { type: String, enum: BILLING_PAYMENT_METHODS, required: true },
  enabled: { type: Boolean, default: false },
  providerKey: { type: String, enum: PAYMENT_PROVIDER_KEYS, required: true }
}, { _id: false });

// Certificado mTLS do Itaú (PEM). O conteúdo fica cifrado em disco; aqui só
// metadados + o caminho. Espelha nfse-config.model.js > CertificateSchema.
const ItauCertificateSchema = new mongoose.Schema({
  filename: { type: String, trim: true },
  storagePath: { type: String, trim: true },   // .crt cifrado em disco
  subjectCN: { type: String, trim: true },
  issuer: { type: String, trim: true },
  notBefore: { type: Date },
  notAfter: { type: Date },
  serialNumber: { type: String, trim: true },
  uploadedAt: { type: Date }
}, { _id: false });

const ItauPrivateKeySchema = new mongoose.Schema({
  filename: { type: String, trim: true },
  storagePath: { type: String, trim: true },   // .key cifrado em disco
  uploadedAt: { type: Date }
}, { _id: false });

const ItauConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  environment: { type: String, enum: ['sandbox', 'production'], default: 'production' },
  clientId: { type: String, trim: true },
  clientSecretEnc: { type: String },          // AES-GCM (crypto.util)
  webhookSecretEnc: { type: String },
  // id_beneficiario (Agência+00+Conta+DAC) usado no cadastro do webhook.
  beneficiaryId: { type: String, trim: true },
  recurringEnabled: { type: Boolean, default: false }, // Pix Automático (Fase 2)
  certificate: { type: ItauCertificateSchema, default: null },
  privateKey: { type: ItauPrivateKeySchema, default: null }
}, { _id: false });

const StripeConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  environment: { type: String, enum: ['test', 'live'], default: 'test' },
  publishableKey: { type: String, trim: true },
  secretKeyEnc: { type: String },
  webhookSecretEnc: { type: String }
}, { _id: false });

// AbacatePay continua configurado por .env (config/abacatepay.js); aqui só o
// toggle de disponibilidade no roteamento.
const AbacatePayConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true }
}, { _id: false });

// Documento ÚNICO (sem companyId) — configuração global do billing da plataforma.
const PaymentSettingsSchema = new mongoose.Schema({
  singleton: { type: String, default: 'billing', unique: true, index: true },
  methods: { type: [MethodRouteSchema], default: [] },
  abacatepay: { type: AbacatePayConfigSchema, default: () => ({}) },
  itau: { type: ItauConfigSchema, default: () => ({}) },
  stripe: { type: StripeConfigSchema, default: () => ({}) },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('PaymentSettings', PaymentSettingsSchema);
