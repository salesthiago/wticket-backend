import mongoose from 'mongoose';

const licenseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  type: { type: String, enum: ['trial', 'basic', 'pro', 'enterprise'], default: 'trial' },
  status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  maxUsers: { type: Number, default: 1 },
  features: [String],
  hardwareId: String
});

module.exports = mongoose.model('License', licenseSchema);