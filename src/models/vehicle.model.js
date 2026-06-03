import mongoose from 'mongoose';

const VehicleSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  plate: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },
  brand: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  year: {
    type: Number
  },
  color: {
    type: String,
    trim: true
  },
  fuel: {
    type: String,
    enum: ['gasoline', 'ethanol', 'flex', 'diesel', 'gnv', 'electric', 'hybrid', 'other'],
    lowercase: true
  },
  chassis: {
    type: String,
    trim: true,
    uppercase: true
  },
  renavam: {
    type: String,
    trim: true
  },
  mileage: {
    type: Number
  },
  notes: {
    type: String,
    trim: true
  },
  // Veículo favorito do cliente. Quando o cliente possui mais de um veículo,
  // o favorito é pré-selecionado nas Ordens de Serviço.
  favorite: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

VehicleSchema.index({ companyId: 1, customerId: 1, isActive: 1 });
VehicleSchema.index({ companyId: 1, plate: 1 });

export default mongoose.model('Vehicle', VehicleSchema);
