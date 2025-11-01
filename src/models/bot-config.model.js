import mongoose from 'mongoose';

const botConfigSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Session'
  },
  enabled: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    required: true,
  },
  welcomeMessage: {
    type: String,
    default: 'Olá! Sou o assistente virtual. Como posso ajudar?'
  },
  defaultResponse: {
    type: String,
    default: 'Entendi sua mensagem. Um atendente humano entrará em contato em breve.'
  },
  businessHours: {
    enabled: Boolean,
    startTime: String, // "09:00"
    endTime: String,   // "18:00"
    offHoursMessage: String
  }
}, {
  timestamps: true
});

export default mongoose.model('BotConfig', botConfigSchema);