import mongoose from 'mongoose';

export const RECEIVABLE_STATUS = ['pending', 'paid', 'overdue', 'cancelled'];

export const PAYMENT_METHODS = [
  'cash',           // Dinheiro
  'pix',            // PIX
  'credit_card',    // Cartão de Crédito
  'debit_card',     // Cartão de Débito
  'bank_transfer',  // Transferência Bancária
  'check',          // Cheque
  'boleto',         // Boleto Bancário
  'other'           // Outro
];

const StatusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  notes: { type: String, trim: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const ReceivableSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },

  // Numeração sequencial por empresa: REC-YYYY-NNNNN
  number: { type: String, index: true },

  description: { type: String, required: true, trim: true },

  amount: { type: Number, required: true, min: 0 },

  dueDate: { type: Date, required: true },
  paymentDate: { type: Date, default: null },

  paymentMethod: {
    type: String,
    enum: PAYMENT_METHODS,
    required: true
  },

  status: {
    type: String,
    enum: RECEIVABLE_STATUS,
    default: 'pending',
    index: true
  },

  // Vínculos
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    index: true,
    default: null
  },
  serviceOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceOrder',
    index: true,
    default: null
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true,
    default: null
  },

  notes: { type: String, trim: true },
  cancelReason: { type: String, trim: true },

  // Auditoria
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  statusHistory: [StatusHistorySchema],

  isActive: { type: Boolean, default: true, index: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

ReceivableSchema.index({ companyId: 1, isActive: 1, createdAt: -1 });
ReceivableSchema.index({ companyId: 1, status: 1, dueDate: 1 });
ReceivableSchema.index({ companyId: 1, customerId: 1 });
ReceivableSchema.index({ companyId: 1, serviceOrderId: 1 });
ReceivableSchema.index({ companyId: 1, projectId: 1 });
ReceivableSchema.index({ companyId: 1, number: 1 }, { unique: true, sparse: true });

// Numeração sequencial por empresa, ano e prefixo REC
ReceivableSchema.pre('save', async function (next) {
  if (this.isNew && !this.number) {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;
    const last = await mongoose.model('Receivable')
      .findOne({
        companyId: this.companyId,
        number: { $regex: `^${prefix}` }
      })
      .sort({ number: -1 })
      .lean();
    let seq = 1;
    if (last) {
      const parts = last.number.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }
    this.number = `${prefix}${String(seq).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model('Receivable', ReceivableSchema);
