import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  contactNumber: { 
    type: String, 
    required: true,
    index: true
  },
  contactName: { 
    type: String 
  },
  sessionName: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    default: 'Atendimento'
  },
  status: {
    type: String,
    enum: ['opened', 'in_progress', 'finished', 'canceled', 'paused'],
    default: 'opened'
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
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
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
  botHandled: {
    type: Boolean,
    default: false,
    index: true
  },
  resolution: {
    type: String
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  notes: {
    type: String
  },
  category: {
    type: String,
    enum: ['support', 'sale'],
    default: 'support',
    index: true
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

// Índices para buscas
TicketSchema.index({ sessionName: 1, status: 1 });
TicketSchema.index({ contactNumber: 1 });
TicketSchema.index({ assignedTo: 1 });
TicketSchema.index({ createdAt: -1 });

export default mongoose.model('Ticket', TicketSchema);