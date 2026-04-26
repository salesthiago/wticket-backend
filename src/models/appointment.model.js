import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  // TODO: make required after bot-agenda service is tenant-aware
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    index: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Contact'
  },
  phone: {
    type: String,
    required: true
  },
  // Data do agendamento
  scheduledDate: {
    type: Date,
    required: true
  },
  // Horário do agendamento (formato HH:mm)
  scheduledTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: props => `${props.value} não é um horário válido! Use o formato HH:mm`
    }
  },
  // Data/hora completa (calculada)
  scheduledDateTime: {
    type: Date,
    required: false
  },
  // Descrição/motivo
  description: {
    type: String,
    required: true
  },
  // Tipo de serviço
  service: {
    type: String,
    required: false
  },
  // Profissional/Atendente responsável
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Status do agendamento
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  // Lembrete enviado
  reminderSent: {
    type: Boolean,
    default: false
  },
  // Data/hora do lembrete
  reminderSentAt: {
    type: Date,
    required: false
  },
  // Confirmação do cliente
  confirmedByClient: {
    type: Boolean,
    default: false
  },
  confirmedAt: {
    type: Date,
    required: false
  },
  // Observações adicionais
  notes: {
    type: String,
    required: false
  },
  // Cancelamento
  cancelledAt: {
    type: Date,
    required: false
  },
  cancelReason: {
    type: String,
    required: false
  },
  // Dados coletados pelo bot
  botData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Índices para performance
appointmentSchema.index({ companyId: 1, phone: 1, status: 1 });
appointmentSchema.index({ companyId: 1, scheduledDate: 1, status: 1 });
appointmentSchema.index({ companyId: 1, contactId: 1, status: 1 });

// Middleware para calcular scheduledDateTime
appointmentSchema.pre('save', function(next) {
  if (this.scheduledDate && this.scheduledTime) {
    const [hours, minutes] = this.scheduledTime.split(':');
    const dateTime = new Date(this.scheduledDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    this.scheduledDateTime = dateTime;
  }
  next();
});

export default mongoose.model('Appointment', appointmentSchema);