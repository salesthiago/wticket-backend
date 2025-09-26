import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  sessionName: { type: String, required: false },
  email: { type: String, required: false, lowercase: true, trim: true },
  status: { type: String, default: 'enabled' },
  avatar: { type: String, default: null },
  city: { type: String, default: null },
  state: { type: String, default: null },
}, { timestamps: true });

ContactSchema.index({ phone: 1 });

export default mongoose.model('Contact', ContactSchema);