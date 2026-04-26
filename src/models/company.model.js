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
  modules: { type: [CompanyModuleSchema], default: [] },
  trialEndsAt: { type: Date }
}, { timestamps: true });

CompanySchema.index({ status: 1, createdAt: -1 });

CompanySchema.methods.hasActiveModule = function (code) {
  if (this.status !== 'active') return false;
  const mod = this.modules.find(m => m.code === code);
  if (!mod) return false;
  if (mod.subscriptionStatus !== 'active') return false;
  if (mod.expiresAt && mod.expiresAt < new Date()) return false;
  return true;
};

CompanySchema.methods.activeModuleCodes = function () {
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
