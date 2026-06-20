import mongoose from 'mongoose';

// Catálogo de códigos de serviço/tributação por empresa.
// cTribNac : código de tributação nacional do ISSQN (6 dígitos)
// cTribMun : código de tributação municipal (até 10 dígitos, varia por prefeitura)
// cNBS     : código NBS (9 dígitos) — opcional
// aliqISSQN: alíquota padrão (% — formato decimal, ex.: 5.00)
// localIncidencia: 'prestador' | 'tomador' | 'local_servico' (informativo)
const NfseServiceCodeSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },

  cTribNac: { type: String, required: true, match: /^\d{6}$/ },
  cTribMun: { type: String, trim: true },
  cNBS: { type: String, trim: true },

  descricao: { type: String, required: true, trim: true, maxlength: 600 },

  aliqISSQN: { type: Number, required: true, min: 0, max: 100 },

  // Retenções padrão (booleans + alíquotas) - editáveis na emissão
  retencoes: {
    iss: { type: Boolean, default: false },
    pis: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
    cofins: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
    irrf: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
    csll: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } },
    cp: { aliq: { type: Number, default: 0 }, retido: { type: Boolean, default: false } }
  },

  localIncidencia: {
    type: String,
    enum: ['prestador', 'tomador', 'local_servico'],
    default: 'prestador'
  },

  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

NfseServiceCodeSchema.index({ companyId: 1, cTribNac: 1 });
NfseServiceCodeSchema.index({ companyId: 1, isActive: 1, descricao: 1 });

export default mongoose.model('NfseServiceCode', NfseServiceCodeSchema);
