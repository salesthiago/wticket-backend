import mongoose from 'mongoose';

const conversationStateSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true
  },
  activeFlow: String, // 'scheduling', 'support', etc
  flowStep: String,
  flowData: mongoose.Schema.Types.Mixed,
  lastInteraction: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// TTL para limpar estados antigos (24h)
conversationStateSchema.index({ lastInteraction: 1 }, { 
  expireAfterSeconds: 24 * 60 * 60 
});

module.exports = mongoose.model('ConversationState', conversationStateSchema);