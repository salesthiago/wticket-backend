import mongoose from 'mongoose';

const TicketStatusSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: '#6c757d'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Garante que só um status seja o padrão por vez dentro da mesma empresa
TicketStatusSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, companyId: this.companyId ?? null },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export default mongoose.model('TicketStatus', TicketStatusSchema);
