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
    respondedAt: { type: Date, default: Date.now }
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

export default mongoose.model('Ticket', TicketSchema);
