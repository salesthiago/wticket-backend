import mongoose from 'mongoose';

// Auditoria de cada chamada à API do Itaú (e webhooks recebidos). É a fonte da
// tela "Histórico de Integração". Espelha models/nfse/nfse-ws-log.model.js.

export const ITAU_LOG_OPERATIONS = [
  'oauth_token',
  'registrar_boleto',
  'consultar_boleto',
  'baixar_boleto',
  'test_connection',
  'webhook'
];

const ItauIntegrationLogSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  boletoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ItauBoleto',
    index: true,
    default: null
  },
  receivableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receivable',
    index: true,
    default: null
  },

  operation: { type: String, required: true, index: true },
  method: { type: String, trim: true },
  url: { type: String, trim: true },
  environment: { type: String, trim: true },

  requestBody: { type: mongoose.Schema.Types.Mixed },   // sanitizado (sem segredos)
  responseBody: { type: mongoose.Schema.Types.Mixed },
  httpStatus: { type: Number },
  durationMs: { type: Number },

  success: { type: Boolean, default: false, index: true },
  errorMessage: { type: String, trim: true }
}, { timestamps: true });

ItauIntegrationLogSchema.index({ companyId: 1, createdAt: -1 });
ItauIntegrationLogSchema.index({ companyId: 1, operation: 1, createdAt: -1 });

export default mongoose.model('ItauIntegrationLog', ItauIntegrationLogSchema);
