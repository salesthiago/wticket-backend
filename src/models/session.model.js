import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  status: { 
    type: String, 
    default: 'notConnected',
    enum: [
      'notConnected', 
      'initializing', 
      'awaiting_qr', 
      'connected', 
      'disconnected',
      'failed',
      'CONFLICT',
      'UNLAUNCHED'
    ]
  },
  number: { 
    type: String 
  },
  source: { 
    type: Object 
  },
  qrCode: {
    type: String
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  client: {
    type: Object
  }
}, { 
  timestamps: true 
});

// Índice para buscas por nome e status
SessionSchema.index({ name: 1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ lastActivity: -1 });

export default mongoose.model('Session', SessionSchema);