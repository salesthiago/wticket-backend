import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema({
  value: String,
  text: String,
  nextStep: { type: Number, default: null }, // Permite fluxo condicional
  // Ação ao selecionar esta opção
  action: {
    type: String,
    enum: ['nextStep', 'callBot', 'finish'],
    default: 'nextStep'
  },
  // ID do bot a ser chamado (quando action = callBot)
  targetBotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BotConfig',
    default: null
  }
}, { _id: false });

const validationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['minLength', 'maxLength', 'regex', 'minValue', 'maxValue', 'futureDate', 'businessDays'],
    required: true
  },
  value: mongoose.Schema.Types.Mixed,
  errorMessage: String
}, { _id: false });

const autoResponseSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  botConfig: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'BotConfig'
  },
  triggerType: {
    type: String,
    enum: ['text', 'date', 'time', 'datetime', 'option', 'phone', 'email', 'number'],
    default: 'text'
  },
  answer: {
    type: String,
    required: true
  },
  // Campo que será salvo (ex: 'description', 'scheduledDate', 'scheduledTime', 'service')
  action: {
    type: String,
    required: false,
    nullable: true
  },
  question: {
    type: String,
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true
  },
  // Ordem de execução
  priority: {
    type: Number,
    default: 1
  },
  // Opções para tipo 'option'
  options: {
    type: [optionSchema],
    default: []
  },
  // Próximo step padrão (se não houver condicional)
  nextStep: {
    type: Number,
    default: null
  },
  // Validações customizadas
  validations: {
    type: [validationSchema],
    default: []
  },
  // Permite pular esta etapa com comando específico
  skipCommand: {
    type: String,
    default: null
  },
  // Mensagem de ajuda
  helpMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

autoResponseSchema.index({ companyId: 1, botConfig: 1, priority: 1 });

export default mongoose.model('AutoResponse', autoResponseSchema);