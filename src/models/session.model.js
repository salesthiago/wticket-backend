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
  },
  // Mensagem de iniciação (obrigatória)
  initiationMessage: {
    type: String,
    default: '👋 Olá! Bem-vindo(a) ao nosso atendimento automático.\n\nPara continuar, por favor digite: PROSSEGUIR'
  },
  // Palavra-chave para iniciar (case-sensitive)
  initiationKeyword: {
    type: String,
    default: 'PROSSEGUIR'
  },
  // Mensagem de finalização
  finalizationMessage: {
    type: String,
    default: '✅ Atendimento finalizado.\n\nObrigado pelo contato! Para iniciar um novo atendimento, envie outra mensagem.'
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  // Agente de IA vinculado a esta sessão (opcional)
  aiAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiAgent',
    default: null
  }
}, {
  timestamps: true
});

// Índice para buscas por nome e status
SessionSchema.index({ name: 1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ lastActivity: -1 });

export default mongoose.model('Session', SessionSchema);