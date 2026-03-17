import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const AiConversationSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiAgent',
    required: true
  },
  sessionId: { type: String }, // opcional: vincular a sessão WhatsApp
  contactPhone: { type: String }, // opcional: número do contato
  titulo: { type: String }, // título gerado automaticamente
  messages: [MessageSchema],
  metadata: { type: Object } // dados extras: leadId, leadInfo, etc.
}, { timestamps: true });

// TTL: remove conversas inativas após 30 dias (para atendimento/vendas)
AiConversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
AiConversationSchema.index({ agentId: 1, createdAt: -1 });

export default mongoose.model('AiConversation', AiConversationSchema);
