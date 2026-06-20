import mongoose from 'mongoose';

// Ambiente DPS (campo tpAmb): 1 = Produção, 2 = Homologação
export const NFSE_AMBIENTE = [1, 2];

// opSimpNac: 1 - Não Optante, 2 - MEI, 3 - ME/EPP
export const NFSE_OP_SIMP_NAC = [1, 2, 3];

// regApTribSN: 1, 2, 3 (somente quando opSimpNac = 3)
export const NFSE_REG_AP_TRIB_SN = [1, 2, 3];

// regEspTrib: 0 a 6 (Nenhum, Cooperativa, Estimativa, ME Municipal, Notário, Autônomo, Soc.Profissionais)
export const NFSE_REG_ESP_TRIB = [0, 1, 2, 3, 4, 5, 6];

const CertificateSchema = new mongoose.Schema({
  filename: { type: String, trim: true },         // nome original do upload
  storagePath: { type: String, trim: true },      // caminho do PFX criptografado em disco
  passwordEnc: { type: String, trim: true },      // senha do PFX cifrada (AES-GCM)
  subjectCN: { type: String, trim: true },        // common name extraído do cert
  subjectCNPJ: { type: String, trim: true },      // CNPJ extraído (OID 2.16.76.1.3.3 / SAN)
  issuer: { type: String, trim: true },
  notBefore: { type: Date },
  notAfter: { type: Date },
  serialNumber: { type: String, trim: true },
  uploadedAt: { type: Date }
}, { _id: false });

const NfseConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true
  },

  // Município emissor (cMun IBGE 7 dígitos)
  cMun: {
    type: String,
    required: true,
    match: /^\d{7}$/
  },
  uf: { type: String, required: true, maxlength: 2, uppercase: true },

  // Inscrição municipal do prestador
  inscricaoMunicipal: { type: String, trim: true },

  // Ambiente DPS: 1 = Produção, 2 = Homologação
  ambiente: {
    type: Number,
    enum: NFSE_AMBIENTE,
    default: 2
  },

  // Regime tributário (DPS - regTrib)
  opSimpNac: { type: Number, enum: NFSE_OP_SIMP_NAC, default: 1 },
  regApTribSN: { type: Number, enum: NFSE_REG_AP_TRIB_SN },
  regEspTrib: { type: Number, enum: NFSE_REG_ESP_TRIB, default: 0 },

  // Numeração da DPS (controle interno do contribuinte)
  serie: { type: Number, default: 1, min: 1 },
  proximoNumeroDps: { type: Number, default: 1, min: 1 },

  // Certificado digital (ICP-Brasil A1)
  certificate: { type: CertificateSchema, default: null },

  // Endpoints SOAP (sobrescrevem o registry, opcional)
  endpoints: {
    homologacao: { type: String, trim: true },
    producao: { type: String, trim: true }
  },

  // Versão do layout / aplicativo gerador (campo verAplic da DPS)
  verAplic: { type: String, default: 'wticket-nfse-1.0' },

  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

// Avança e devolve o próximo número de DPS, de forma atômica
NfseConfigSchema.statics.allocateNextDps = async function (companyId) {
  const updated = await this.findOneAndUpdate(
    { companyId },
    { $inc: { proximoNumeroDps: 1 } },
    { new: false }
  );
  if (!updated) throw new Error('NFSe config not found for company');
  return updated.proximoNumeroDps;
};

export default mongoose.model('NfseConfig', NfseConfigSchema);
