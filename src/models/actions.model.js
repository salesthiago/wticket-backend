import mongoose from 'mongoose';

const actionsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  script: {
    type: Object,
  },
  status: {
    type: String,
    enum: ['enabled', 'disabled'],
    default: 'enabled'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Actions', actionsSchema);