import mongoose from 'mongoose';

export const COMPANY_STATUS = ['pending_payment', 'active', 'suspended', 'cancelled'];
export const SUBSCRIPTION_STATUS = ['pending', 'active', 'expired', 'cancelled'];

const AddressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  number: { type: String, trim: true },
  complement: { type: String, trim: true },
  neighborhood: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true, maxlength: 2, uppercase: true },
  zipCode: { type: String, trim: true },
  country: { type: String, trim: true, default: 'BR' }
}, { _id: false });

const CompanyModuleSchema = new mongoose.Schema({
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  code: { type: String, required: true },
  subscriptionStatus: {
    type: String,
    enum: SUBSCRIPTION_STATUS,
    default: 'pending'
  },
  activatedAt: { type: Date },
  expiresAt: { type: Date }
}, { _id: false });

// Configuração S3 por empresa. Quando ausente ou enabled=false, usa as credenciais
// padrão do .env. O secretAccessKey é cifrado com AES-256-GCM (utils/crypto.util.js)
// reaproveitando a chave NFSE_CERT_KEY.
const StorageConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  bucket: { type: String, trim: true },
  region: { type: String, trim: true },
  accessKeyId: { type: String, trim: true },
  secretAccessKeyEnc: { type: String, trim: true }, // cifrado, nunca exposto na API
  prefix: { type: String, trim: true, default: '' }, // ex.: 'wticket/'
  publicBaseUrl: { type: String, trim: true },        // ex.: CloudFront URL
  endpoint: { type: String, trim: true },             // S3-compatible (R2, MinIO etc.)
  forcePathStyle: { type: Boolean, default: false },
  testedAt: { type: Date },
  testOk: { type: Boolean, default: false }
}, { _id: false });

// Logo da empresa. Quando enviada, é armazenada no S3 (publicRead) reaproveitando
// o storageConfig da empresa; storageSource indica a origem (company/default).
const LogoSchema = new mongoose.Schema({
  url: { type: String, trim: true },
  storageKey: { type: String, trim: true },
  storageBucket: { type: String, trim: true },
  storageSource: { type: String, trim: true }
}, { _id: false });

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  document: { type: String, trim: true, index: true, sparse: true },
  documentType: { type: String, enum: ['cpf', 'cnpj'], default: 'cnpj' },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true },
  address: { type: AddressSchema, default: {} },
  status: {
    type: String,
    enum: COMPANY_STATUS,
    default: 'pending_payment',
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Plano (assinatura) escolhido no cadastro; define os módulos e o preço único.
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan'
  },
  // Vínculos com o AbacatePay (cliente e assinatura recorrente ativa).
  abacateCustomerId: { type: String, trim: true },
  abacateSubscriptionId: { type: String, trim: true },
  modules: { type: [CompanyModuleSchema], default: [] },
  storageConfig: { type: StorageConfigSchema, default: null },
  logo: { type: LogoSchema, default: null },
  trialEndsAt: { type: Date },
  // Quando true, o super_admin isenta a empresa de assinatura:
  // todos os módulos cadastrados ficam ativos independente de pagamento.
  subscriptionExempt: { type: Boolean, default: false }
}, { timestamps: true });

CompanySchema.index({ status: 1, createdAt: -1 });

CompanySchema.methods.hasActiveModule = function (code) {
  if (this.subscriptionExempt) {
    return this.modules.some(m => m.code === code);
  }
  if (this.status !== 'active') return false;
  const mod = this.modules.find(m => m.code === code);
  if (!mod) return false;
  if (mod.subscriptionStatus !== 'active') return false;
  if (mod.expiresAt && mod.expiresAt < new Date()) return false;
  return true;
};

CompanySchema.methods.activeModuleCodes = function () {
  if (this.subscriptionExempt) {
    return this.modules.map(m => m.code);
  }
  if (this.status !== 'active') return [];
  return this.modules
    .filter(m => {
      if (m.subscriptionStatus !== 'active') return false;
      if (m.expiresAt && m.expiresAt < new Date()) return false;
      return true;
    })
    .map(m => m.code);
};

export default mongoose.model('Company', CompanySchema);
