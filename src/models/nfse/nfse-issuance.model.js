import mongoose from 'mongoose';

export const NFSE_STATUS = [
  'draft',         // criada, ainda não enviada
  'signing',       // sendo assinada
  'queued',        // pronta para envio (lote assíncrono)
  'sending',       // enviando ao webservice
  'processing',    // aguardando processamento (lote assíncrono)
  'authorized',    // NFS-e gerada com sucesso
  'rejected',      // rejeitada por validação de negócio
  'cancelled',     // cancelada após autorização
  'error'          // erro técnico (timeout, conexão, etc.)
];

const StatusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  message: { type: String, trim: true },
  at: { type: Date, default: Date.now }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  codigo: { type: String, trim: true },
  mensagem: { type: String, trim: true },
  correcao: { type: String, trim: true }
}, { _id: false });

// Snapshot dos dados usados para gerar a DPS — preserva consistência
// histórica mesmo quando customer/serviço forem editados depois.
const PartySchema = new mongoose.Schema({
  documentType: { type: String, enum: ['cnpj', 'cpf', 'nif'] },
  document: { type: String, trim: true },
  inscricaoMunicipal: { type: String, trim: true },
  nome: { type: String, trim: true },
  email: { type: String, trim: true },
  fone: { type: String, trim: true },
  endereco: {
    cMun: { type: String, trim: true },
    uf: { type: String, trim: true },
    cep: { type: String, trim: true },
    xLgr: { type: String, trim: true },
    nro: { type: String, trim: true },
    xCpl: { type: String, trim: true },
    xBairro: { type: String, trim: true },
    cPais: { type: String, trim: true },        // para endExt
    cEndPost: { type: String, trim: true },     // para endExt
    xCidade: { type: String, trim: true },
    xEstProvReg: { type: String, trim: true }
  }
}, { _id: false });

const ServicoSchema = new mongoose.Schema({
  cTribNac: { type: String, trim: true },
  cTribMun: { type: String, trim: true },
  cNBS: { type: String, trim: true },
  xDescServ: { type: String, trim: true },
  cLocPrestacao: { type: String, trim: true },
  cPaisPrestacao: { type: String, trim: true, default: '1058' } // Brasil ISO
}, { _id: false });

const ValoresSchema = new mongoose.Schema({
  vServ: { type: Number, default: 0 },
  descIncond: { type: Number, default: 0 },
  descCond: { type: Number, default: 0 },

  // ISSQN
  issqn: {
    tribISSQN: { type: Number, default: 1 }, // 1=Operação Tributável
    pAliq: { type: Number, default: 0 },
    tpRetISSQN: { type: Number, default: 1 } // 1=Não Retido (ajustar conforme manual)
  },

  // Federais (retenções)
  pis: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
  cofins: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
  irrf: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
  csll: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
  cp: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },

  // Calculados
  vBC: { type: Number, default: 0 },
  vISSQN: { type: Number, default: 0 },
  vTotalRet: { type: Number, default: 0 },
  vLiq: { type: Number, default: 0 }
}, { _id: false });

const NfseIssuanceSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    index: true
  },
  serviceOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceOrder',
    index: true,
    default: null
  },

  // Identificação interna
  serie: { type: Number, required: true },
  nDPS: { type: Number, required: true },
  tpAmb: { type: Number, enum: [1, 2], required: true },
  tpEmit: { type: Number, enum: [1, 2, 3], default: 1 }, // 1=Prestador
  cLocEmi: { type: String, required: true, match: /^\d{7}$/ },
  dCompet: { type: Date, required: true },
  dhEmi: { type: Date, default: Date.now },

  // Identificadores gerados pela prefeitura (após autorização)
  chaveAcesso: { type: String, trim: true, index: true, sparse: true }, // 50 dígitos
  numeroNfse: { type: String, trim: true },
  cStat: { type: String, trim: true }, // 100, 101, 102, 103, 107
  dhProc: { type: Date },
  protocolo: { type: String, trim: true },
  urlConsulta: { type: String, trim: true },

  // Snapshots
  prestador: { type: PartySchema, required: true },
  tomador: { type: PartySchema, default: null },
  intermediario: { type: PartySchema, default: null },
  servico: { type: ServicoSchema, required: true },
  valores: { type: ValoresSchema, required: true },

  // XML
  dpsId: { type: String, trim: true }, // valor do atributo Id da DPS
  xmlDpsAssinado: { type: String }, // armazenado para auditoria
  xmlNfseRetorno: { type: String },

  // Status
  status: {
    type: String,
    enum: NFSE_STATUS,
    default: 'draft',
    index: true
  },
  statusHistory: [StatusHistorySchema],
  mensagensRetorno: [MessageSchema],

  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

NfseIssuanceSchema.index({ companyId: 1, isActive: 1, createdAt: -1 });
NfseIssuanceSchema.index({ companyId: 1, status: 1 });
NfseIssuanceSchema.index({ companyId: 1, serie: 1, nDPS: 1 }, { unique: true });

NfseIssuanceSchema.methods.pushStatus = function (status, message) {
  this.status = status;
  this.statusHistory.push({ status, message, at: new Date() });
};

export default mongoose.model('NfseIssuance', NfseIssuanceSchema);
