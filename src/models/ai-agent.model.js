import mongoose from 'mongoose';

const DadosProdutoSchema = new mongoose.Schema({
  nome: { type: String },
  preco: { type: String },
  beneficios: [{ type: String }]
}, { _id: false });

const AiAgentSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  nome: { type: String, required: true, trim: true },
  descricao: { type: String, trim: true },
  tipo: {
    type: String,
    enum: ['atendimento', 'vendas', 'campanhas', 'analise_leads'],
    required: true
  },
  tom: {
    type: String,
    enum: ['formal', 'informal', 'persuasivo', 'amigavel', 'profissional', 'neutro', 'empático'],
    default: 'profissional'
  },
  regras: [{ type: String }],
  dados_produto: { type: DadosProdutoSchema, default: null },
  status: {
    type: String,
    enum: ['ativo', 'inativo'],
    default: 'ativo'
  },
  totalMensagens: { type: Number, default: 0 },
  totalGeracoes: { type: Number, default: 0 }
}, { timestamps: true });

AiAgentSchema.index({ companyId: 1, tipo: 1, status: 1 });
AiAgentSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model('AiAgent', AiAgentSchema);
