import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
  // TODO: make required after whatsapp ingestion services are tenant-aware
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    index: true
  },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  sessionName: { type: String, required: false },
  email: { type: String, required: false, lowercase: true, trim: true },
  status: { type: String, default: 'enabled' },
  avatar: { type: String, default: null },
  city: { type: String, default: null },
  state: { type: String, default: null },
}, { timestamps: true });

ContactSchema.index({ companyId: 1, phone: 1 });

export default mongoose.model('Contact', ContactSchema);