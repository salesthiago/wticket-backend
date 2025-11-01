import mongoose from 'mongoose';

const autoResponseSchema = new mongoose.Schema({
  botConfig: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'BotConfig'
  },
  triggerType: {
    type: String,
    enum: ['text', 'date', 'option'],
    default: 'text'
  },
  trigger: {
    type: String,
    required: true
  },
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
  priority: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

export default mongoose.model('AutoResponse', autoResponseSchema);