import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  contactNumber: {
    type: String,
    index: true
  },
  contactName: {
    type: String
  },
  // Cliente selecionado no cadastro do ticket (substitui a digitação manual de
  // telefone/nome quando o atendente escolhe um cliente já cadastrado)
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
    index: true
  },
  // sessionName desabilitado: era usado pelo WhatsApp (será serviço separado)
  // sessionName: {
  //   type: String,
  //   index: true
  // },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketCategory'
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketSubject'
  },
  statusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketStatus'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Usuário que criou este ticket/tarefa — usado para permitir exclusão
  // (autor ou administrador) sem depender só do escopo de empresa/cliente.
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  tags: [{
    type: String
  }],
  // messages desabilitado: dependente do WhatsApp (será serviço separado)
  // messages: [{
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Message'
  // }],
  responses: [{
    content: { type: String, required: true },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    respondedAt: { type: Date, default: Date.now },
    // Horas gastas nesta atualização — somadas em workedHours a cada resposta
    hoursSpent: { type: Number, default: 0, min: 0 }
  }],
  lastMessage: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  closedAt: {
    type: Date
  },
  closedBy: {
    type: String
  },
  // botHandled e aiHandled desabilitados: dependentes do WhatsApp
  // botHandled: {
  //   type: Boolean,
  //   default: false,
  //   index: true
  // },
  // aiHandled: {
  //   type: Boolean,
  //   default: false,
  //   index: true
  // },
  // aiAgentId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'AiAgent',
  //   default: null
  // },
  resolution: {
    type: String
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  serviceOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceOrder'
  },
  // Vincula este ticket como uma tarefa de um Projeto
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
    index: true
  },
  // Horas trabalhadas nesta tarefa, somadas na tela do projeto
  workedHours: {
    type: Number,
    default: 0,
    min: 0
  },
  // Número da tarefa, gerado automaticamente a partir do número do projeto
  // (ex.: PRJ-2026-00001-01) quando o ticket é criado dentro de um projeto
  taskNumber: {
    type: String,
    index: true
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  notes: {
    type: String
  },
  saleItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    sold: { type: Boolean, default: false },
    notes: { type: String }
  }]
}, {
  timestamps: true
});

TicketSchema.index({ statusId: 1 });
TicketSchema.index({ categoryId: 1 });
TicketSchema.index({ assignedTo: 1 });
TicketSchema.index({ createdAt: -1 });

// Gera o número da tarefa a partir do número do projeto (contrato) ao qual
// o ticket pertence, ex.: PRJ-2026-00001-01, -02, ... (sequência por projeto)
TicketSchema.pre('save', async function (next) {
  if (this.isNew && this.projectId && !this.taskNumber) {
    const Project = mongoose.model('Project');
    const project = await Project.findById(this.projectId).select('projectNumber').lean();
    if (project?.projectNumber) {
      const existingCount = await mongoose.model('Ticket').countDocuments({ projectId: this.projectId });
      this.taskNumber = `${project.projectNumber}-${String(existingCount + 1).padStart(2, '0')}`;
    }
  }
  next();
});

export default mongoose.model('Ticket', TicketSchema);
