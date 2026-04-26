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

const LeadSchema = new mongoose.Schema({
  // TODO: make required after AI/lead extraction services are tenant-aware
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
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
    trim: true
  },
  address: {
    type: AddressSchema,
    default: {}
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new',
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  convertedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  convertedAt: {
    type: Date,
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

LeadSchema.index({ companyId: 1, isActive: 1, status: 1, createdAt: -1 });

export default mongoose.model('Lead', LeadSchema);
