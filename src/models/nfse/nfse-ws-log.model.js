import mongoose from 'mongoose';

// Auditoria de cada chamada SOAP feita ao webservice da prefeitura.
// Útil para diagnóstico, suporte e revalidação.
const NfseWsLogSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  issuanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NfseIssuance',
    index: true,
    default: null
  },

  operation: { type: String, required: true, index: true }, // GerarNfse, CancelarNfse, etc.
  endpoint: { type: String, trim: true },
  ambiente: { type: Number, enum: [1, 2] },

  request: { type: String },     // SOAP envelope enviado
  response: { type: String },    // SOAP envelope recebido (ou mensagem de erro)
  httpStatus: { type: Number },
  durationMs: { type: Number },

  success: { type: Boolean, default: false, index: true },
  errorMessage: { type: String, trim: true }
}, { timestamps: true });

NfseWsLogSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model('NfseWsLog', NfseWsLogSchema);
