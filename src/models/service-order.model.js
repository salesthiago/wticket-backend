import mongoose from 'mongoose';

const ServiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, default: 1, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const PartSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, default: 1, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  // Vínculo opcional com o catálogo de produtos (peça pode ser texto livre)
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  // Quanto desta peça já foi baixado do estoque (controle de reconciliação)
  deductedQuantity: { type: Number, default: 0, min: 0 }
}, { _id: false });

// Foto anexada à OS (ex.: estado do veículo na entrada). Armazenada no S3 da
// empresa quando configurado, com fallback para disco local (/uploads).
const PhotoSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  storageKey: { type: String, trim: true },
  storageBucket: { type: String, trim: true },
  storageSource: { type: String, enum: ['company', 'default', 'local'], default: 'local' },
  filename: { type: String, trim: true },
  mimetype: { type: String, trim: true },
  size: { type: Number },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const StatusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const ServiceOrderSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  // Numero sequencial da OS (unique per company)
  orderNumber: {
    type: String,
    index: true
  },

  // Cliente
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },

  // Veículo (oficina) — referência opcional ao veículo do cliente
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    index: true
  },

  // Equipamento (na oficina: o automóvel)
  equipment: {
    type: { type: String, required: true, trim: true },       // ex: Notebook, Celular | oficina: 'automovel'
    brand: { type: String, trim: true },                       // ex: Dell | oficina: marca do veículo
    model: { type: String, trim: true },                       // ex: Inspiron 15 | oficina: modelo do veículo
    plate: { type: String, trim: true, uppercase: true },      // Placa (oficina)
    mileage: { type: Number, min: 0 },                         // KM informado na OS (oficina)
    serialNumber: { type: String, trim: true },                // oficina: chassi, se desejado
    accessories: { type: String, trim: true },                 // ex: Carregador, Cabo USB
    condition: { type: String, trim: true }                    // Estado fisico na entrada
  },

  // Fotos anexadas à OS (oficina: fotos do carro)
  photos: [PhotoSchema],

  // Problema
  reportedIssue: {
    type: String,
    required: true,
    trim: true
  },

  // Diagnostico tecnico
  diagnosis: {
    type: String,
    trim: true
  },

  // Servicos realizados
  services: [ServiceItemSchema],

  // Pecas utilizadas
  parts: [PartSchema],

  // Orcamento
  estimatedCost: {
    type: Number,
    default: 0,
    min: 0
  },

  // Custo final
  finalCost: {
    type: Number,
    default: 0,
    min: 0
  },

  // Status
  status: {
    type: String,
    enum: ['open', 'diagnosing', 'quoted', 'approved', 'in_progress', 'completed', 'delivered', 'cancelled'],
    default: 'open',
    index: true
  },

  // Prioridade
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Tecnico responsavel
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Previsao de entrega
  estimatedCompletionDate: {
    type: Date
  },

  // Data de conclusao real
  completedAt: {
    type: Date
  },

  // Data de entrega ao cliente
  deliveredAt: {
    type: Date
  },

  // Garantia (dias)
  warrantyDays: {
    type: Number,
    default: 90,
    min: 0
  },

  // Data de expiracao da garantia (calculada na entrega)
  warrantyExpiresAt: {
    type: Date
  },

  // Observacoes internas
  internalNotes: {
    type: String,
    trim: true
  },

  // Motivo do cancelamento
  cancelReason: {
    type: String,
    trim: true
  },

  // Historico de mudancas de status
  statusHistory: [StatusHistorySchema],

  // Soft delete
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

// Indexes
ServiceOrderSchema.index({ companyId: 1, isActive: 1, createdAt: -1 });
ServiceOrderSchema.index({ companyId: 1, customerId: 1, status: 1 });
ServiceOrderSchema.index({ companyId: 1, technicianId: 1, status: 1 });
ServiceOrderSchema.index({ companyId: 1, orderNumber: 1 }, { unique: true, sparse: true });
ServiceOrderSchema.index({ 'equipment.serialNumber': 1 }, { sparse: true });

// Gerar numero sequencial da OS antes de salvar (sequencia por empresa)
ServiceOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const year = new Date().getFullYear();
    const lastOrder = await mongoose.model('ServiceOrder')
      .findOne({
        companyId: this.companyId,
        orderNumber: { $regex: `^OS-${year}` }
      })
      .sort({ orderNumber: -1 })
      .lean();

    let seq = 1;
    if (lastOrder) {
      const parts = lastOrder.orderNumber.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }

    this.orderNumber = `OS-${year}-${String(seq).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model('ServiceOrder', ServiceOrderSchema);
