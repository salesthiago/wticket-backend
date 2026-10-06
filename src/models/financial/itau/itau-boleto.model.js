import mongoose from 'mongoose';

// Boleto registrado no Itaú a partir de um título de Contas a Receber (Receivable).
// Boleto híbrido: carrega também o payload PIX (copia-e-cola + QR) para pagamento.

export const ITAU_BOLETO_STATUS = [
  'registrado',   // aceito pelo Itaú, aguardando pagamento
  'pago',         // liquidado
  'baixado',      // baixado/cancelado no Itaú (sem pagamento)
  'vencido',      // venceu sem pagamento
  'cancelado',    // cancelado internamente
  'erro'          // falha ao registrar
];

const StatusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  message: { type: String, trim: true },
  at: { type: Date, default: Date.now }
}, { _id: false });

const PagadorSchema = new mongoose.Schema({
  nome: { type: String, trim: true },
  documento: { type: String, trim: true },
  documentoTipo: { type: String, enum: ['cpf', 'cnpj'], default: 'cnpj' },
  email: { type: String, trim: true },
  logradouro: { type: String, trim: true },
  numero: { type: String, trim: true },
  complemento: { type: String, trim: true },
  bairro: { type: String, trim: true },
  cidade: { type: String, trim: true },
  uf: { type: String, trim: true },
  cep: { type: String, trim: true }
}, { _id: false });

const PixSchema = new mongoose.Schema({
  emv: { type: String, trim: true },        // copia-e-cola (BR Code)
  qrCodeImage: { type: String },            // data URL PNG gerado com qrcode
  txid: { type: String, trim: true },
  location: { type: String, trim: true },
  expiraEm: { type: Date }
}, { _id: false });

const ItauBoletoSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  receivableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receivable',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },

  // Identificação bancária
  nossoNumero: { type: String, trim: true, index: true },
  carteira: { type: String, trim: true },
  agencia: { type: String, trim: true },
  conta: { type: String, trim: true },

  // Identificadores devolvidos pelo Itaú
  itauId: { type: String, trim: true },
  txid: { type: String, trim: true },

  valor: { type: Number, required: true, min: 0 },
  dataVencimento: { type: Date, required: true },
  dataEmissao: { type: Date, default: Date.now },

  linhaDigitavel: { type: String, trim: true },
  codigoBarras: { type: String, trim: true },

  pix: { type: PixSchema, default: null },

  status: {
    type: String,
    enum: ITAU_BOLETO_STATUS,
    default: 'registrado',
    index: true
  },
  statusHistory: [StatusHistorySchema],

  pagador: { type: PagadorSchema, default: null },

  // Auditoria da chamada de registro
  rawRequest: { type: mongoose.Schema.Types.Mixed },
  rawResponse: { type: mongoose.Schema.Types.Mixed },
  errorMessage: { type: String, trim: true },

  pdfGeneratedAt: { type: Date },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  isActive: { type: Boolean, default: true, index: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

ItauBoletoSchema.index({ companyId: 1, isActive: 1, createdAt: -1 });
// Um único boleto ativo (não cancelado) por título
ItauBoletoSchema.index(
  { companyId: 1, receivableId: 1 },
  { unique: true, partialFilterExpression: { isActive: true, status: { $ne: 'cancelado' } } }
);

ItauBoletoSchema.methods.pushStatus = function (status, message) {
  this.status = status;
  this.statusHistory.push({ status, message, at: new Date() });
};

export default mongoose.model('ItauBoleto', ItauBoletoSchema);
