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
    unique: true
  },
  description: {
    type: String,
    required: false
  },
  // Palavra-chave para ativar este bot no menu (ex: ORACAO, VOLUNTARIOS)
  triggerKeyword: {
    type: String,
    required: false,
    uppercase: true,
    trim: true
  },
  // Se este bot está ativo para aparecer no menu
  isActive: {
    type: Boolean,
    default: true
  },
  // Tipo do bot
  type: {
    type: String,
    enum: ['appointment', 'faq', 'survey', 'custom'],
    default: 'appointment'
  },
  welcomeMessage: {
    type: String,
    default: 'Olá! Sou o assistente virtual. Como posso ajudar?'
  },
  defaultResponse: {
    type: String,
    default: 'Entendi sua mensagem. Um atendente humano entrará em contato em breve.'
  },
  // Mensagem de confirmação final
  confirmationMessage: {
    type: String,
    default: '✅ Agendamento confirmado! Você receberá um lembrete antes do horário.'
  },
  // Mensagem de cancelamento
  cancelMessage: {
    type: String,
    default: 'Agendamento cancelado. Até logo!'
  },
  businessHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
    offHoursMessage: { type: String, default: 'Estamos fora do horário de atendimento.' },
    // Dias da semana (0=Domingo, 6=Sábado)
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5] // Segunda a Sexta
    }
  },
  // Configurações de agendamento
  appointmentSettings: {
    // Duração padrão em minutos
    defaultDuration: { type: Number, default: 60 },
    // Intervalo entre agendamentos em minutos
    slotInterval: { type: Number, default: 30 },
    // Antecedência mínima em horas
    minAdvanceHours: { type: Number, default: 2 },
    // Antecedência máxima em dias
    maxAdvanceDays: { type: Number, default: 30 },
    // Horários disponíveis
    availableSlots: {
      type: [String],
      default: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']
    }
  },
  // Comandos especiais
  commands: {
    cancel: { type: [String], default: ['cancelar', 'sair', 'parar'] },
    restart: { type: [String], default: ['reiniciar', 'começar de novo'] },
    help: { type: [String], default: ['ajuda', 'help', '?'] }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

botConfigSchema.virtual('autoResponses', {
  ref: 'AutoResponse',
  localField: '_id',
  foreignField: 'botConfig'
});

botConfigSchema.index({ name: 1 }, { unique: true });
botConfigSchema.index({ enabled: 1 });
botConfigSchema.index({ sessionId: 1, isActive: 1 });
botConfigSchema.index({ triggerKeyword: 1 });

export default mongoose.model('BotConfig', botConfigSchema);