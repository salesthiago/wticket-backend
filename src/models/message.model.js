import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  // TODO: make required after message-processor service is tenant-aware
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    index: true
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    required: true
  },
  isFromMe: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  mediaUrl: {
    type: String
  },
  caption: {
    type: String
  }
}, { 
  timestamps: true 
});

// Índices para buscas
MessageSchema.index({ ticketId: 1, timestamp: -1 });
MessageSchema.index({ messageId: 1 }, { unique: true });

export default mongoose.model('Message', MessageSchema);