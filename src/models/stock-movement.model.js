import mongoose from 'mongoose';

const StockMovementSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  // Direção do movimento
  type: {
    type: String,
    enum: ['in', 'out'],
    required: true
  },
  // Origem/motivo do movimento
  reason: {
    type: String,
    enum: ['manual_in', 'manual_out', 'service_order', 'service_order_reversal', 'adjustment'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  // Saldo do produto logo após este movimento
  balanceAfter: {
    type: Number,
    required: true
  },
  // Referência (de onde veio o movimento)
  referenceType: {
    type: String,
    enum: ['manual', 'service_order'],
    default: 'manual'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    sparse: true
  },
  referenceLabel: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

StockMovementSchema.index({ companyId: 1, productId: 1, createdAt: -1 });

export default mongoose.model('StockMovement', StockMovementSchema);
