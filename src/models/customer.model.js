import mongoose from 'mongoose';

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

const CustomerSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
    sparse: true
  },
  documentType: {
    type: String,
    enum: ['cpf', 'cnpj'],
    lowercase: true
  },
  document: {
    type: String,
    trim: true,
    index: true,
    sparse: true
  },
  address: {
    type: AddressSchema,
    default: {}
  },
  source: {
    type: String,
    enum: ['manual', 'lead'],
    default: 'manual'
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

CustomerSchema.index({ name: 'text', email: 'text' });
CustomerSchema.index({ companyId: 1, isActive: 1, createdAt: -1 });

export default mongoose.model('Customer', CustomerSchema);
