import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['enabled', 'disabled'],
    default: 'enabled'
  },
  name: {
    type: String
  },
  value: {
    type: Object
  }
}, { 
  timestamps: true 
});

SettingsSchema.index({ createdAt: -1 });

export default mongoose.model('Setting', SettingsSchema);