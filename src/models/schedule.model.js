import mongoose from 'mongoose';

const scheduledSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'sended', 'canceled'],
    default: 'pending'
  },
  message: String,
  scheduled_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});


module.exports = mongoose.model('Schedule', scheduledSchema);