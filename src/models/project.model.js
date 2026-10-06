import mongoose from 'mongoose';

// Documento anexado ao projeto (contrato, planilha, foto etc). Armazenado no
// S3 da empresa quando configurado, com fallback para disco local (/uploads) —
// mesmo padrão já usado para fotos de Ordem de Serviço.
const ProjectDocumentSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  storageKey: { type: String, trim: true },
  storageBucket: { type: String, trim: true },
  storageSource: { type: String, enum: ['company', 'default', 'local'], default: 'local' },
  filename: { type: String, trim: true },
  mimetype: { type: String, trim: true },
  size: { type: Number },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const ProjectSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  projectNumber: {
    type: String,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date
  },
  // Prazo planejado de término
  endDate: {
    type: Date
  },
  // Data real de encerramento — preenchida automaticamente quando o status
  // vira um ProjectStatus com isClosingStatus = true (ver project.repository.js)
  closedAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  statusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectStatus'
  },
  // Vínculo com cliente é opcional
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  // Valor/hora usado para calcular o valor total do projeto (horas trabalhadas x hourlyRate)
  hourlyRate: {
    type: Number,
    default: 0,
    min: 0
  },
  // Usuário que criou o projeto — usado para permitir exclusão (autor ou
  // administrador), inclusive quando é o próprio cliente quem cria.
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Documentos anexados ao projeto (contratos, planilhas, arquivos diversos)
  documents: [ProjectDocumentSchema]
}, {
  timestamps: true
});

ProjectSchema.index({ companyId: 1, statusId: 1 });
ProjectSchema.index({ companyId: 1, customerId: 1 });
ProjectSchema.index({ createdAt: -1 });

// Gera número sequencial do projeto (PRJ-AAAA-00001), sequência por empresa/ano
ProjectSchema.pre('save', async function (next) {
  if (this.isNew && !this.projectNumber) {
    const year = new Date().getFullYear();
    const lastProject = await mongoose.model('Project')
      .findOne({
        companyId: this.companyId ?? null,
        projectNumber: { $regex: `^PRJ-${year}` }
      })
      .sort({ projectNumber: -1 })
      .lean();

    let seq = 1;
    if (lastProject) {
      const parts = lastProject.projectNumber.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }

    this.projectNumber = `PRJ-${year}-${String(seq).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model('Project', ProjectSchema);
