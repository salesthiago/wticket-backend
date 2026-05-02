import mongoose from 'mongoose';

export const MODULE_CODES = ['attendance', 'service_order', 'auto_attendance', 'nfse', 'financial'];

const ModuleSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    enum: MODULE_CODES,
    index: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  features: [{ type: String, trim: true }],
  price: { type: Number, default: 0, min: 0 },
  requires: [{ type: String, enum: MODULE_CODES }],
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

export default mongoose.model('Module', ModuleSchema);
