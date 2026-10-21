import mongoose from 'mongoose';

// Funil comercial da PLATAFORMA (prospecção de novas empresas assinantes pelo
// super_admin). Não tem relação com o Lead das empresas (models/lead.model.js),
// que é tenant-scoped e vira Customer via orçamento de OS.
export const PLATFORM_LEAD_STATUS = ['new', 'contacted', 'negotiating', 'proposal', 'won', 'lost'];

export const PLATFORM_LEAD_STATUS_LABELS = {
  new: 'Novo',
  contacted: 'Contatado',
  negotiating: 'Em negociação',
  proposal: 'Proposta enviada',
  won: 'Fechado',
  lost: 'Perdido'
};

const PlatformLeadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  company: { type: String, trim: true },
  phone: { type: String, required: true, trim: true },
  // Só dígitos — usado para deduplicar cadastros/importações.
  phoneDigits: { type: String, index: true },
  email: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: PLATFORM_LEAD_STATUS, default: 'new', index: true },
  // Ramo de atividade (texto livre: "Oficina mecânica", "Assistência técnica"...).
  segment: { type: String, trim: true, index: true },
  notes: { type: String, trim: true },
  source: { type: String, enum: ['manual', 'csv'], default: 'manual' },
  // Data em que o lead entrou no status atual (won/lost alimentam o dashboard).
  statusChangedAt: { type: Date, default: Date.now }
}, { timestamps: true });

PlatformLeadSchema.pre('save', function (next) {
  if (this.isModified('phone')) this.phoneDigits = String(this.phone || '').replace(/\D/g, '');
  next();
});

PlatformLeadSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PlatformLead', PlatformLeadSchema);
