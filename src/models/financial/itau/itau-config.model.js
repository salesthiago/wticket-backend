import mongoose from 'mongoose';

// Configuração da conta Itaú de UMA empresa (tenant). Um documento por companyId.
// Espelha o ItauConfigSchema de models/billing/payment-settings.model.js, mas é
// multi-tenant e vive no módulo financeiro (não tem relação com o billing da
// plataforma).

export const ITAU_ENVIRONMENTS = ['homologacao', 'producao'];
export const ITAU_PIX_KEY_TYPES = ['cnpj', 'cpf', 'email', 'telefone', 'aleatoria'];

// Certificado mTLS (PEM). O conteúdo fica cifrado em disco (AES-256-GCM via
// utils/crypto.util.js); aqui só metadados + o caminho.
const ItauCertificateSchema = new mongoose.Schema({
  filename: { type: String, trim: true },
  storagePath: { type: String, trim: true },   // .crt/.pem cifrado em disco
  subjectCN: { type: String, trim: true },
  issuer: { type: String, trim: true },
  notBefore: { type: Date },
  notAfter: { type: Date },
  serialNumber: { type: String, trim: true },
  uploadedAt: { type: Date }
}, { _id: false });

const ItauPrivateKeySchema = new mongoose.Schema({
  filename: { type: String, trim: true },
  storagePath: { type: String, trim: true },   // .key cifrado em disco
  uploadedAt: { type: Date }
}, { _id: false });

// Endereço do beneficiário (cedente) impresso no boleto. Default: endereço da empresa.
const BeneficiarioEnderecoSchema = new mongoose.Schema({
  logradouro: { type: String, trim: true },
  numero: { type: String, trim: true },
  complemento: { type: String, trim: true },
  bairro: { type: String, trim: true },
  cidade: { type: String, trim: true },
  uf: { type: String, trim: true, maxlength: 2, uppercase: true },
  cep: { type: String, trim: true }
}, { _id: false });

const ItauConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true
  },

  environment: { type: String, enum: ITAU_ENVIRONMENTS, default: 'homologacao' },

  // Credenciais OAuth2 (client_credentials + mTLS)
  clientId: { type: String, trim: true },
  clientSecretEnc: { type: String },     // AES-256-GCM
  webhookSecretEnc: { type: String },    // opcional (validação HMAC do webhook)

  certificate: { type: ItauCertificateSchema, default: null },
  privateKey: { type: ItauPrivateKeySchema, default: null },

  // Dados bancários da conta de cobrança
  agencia: { type: String, trim: true },            // 4 dígitos
  conta: { type: String, trim: true },              // até 7 dígitos (sem DAC)
  contaDAC: { type: String, trim: true },           // 1 dígito
  carteira: { type: String, trim: true, default: '109' },
  // id_beneficiario Itaú (agência + zeros + conta + DAC), usado no payload
  beneficiaryId: { type: String, trim: true },

  // PIX (chave DICT registrada para a conta) — usada no QR do boleto híbrido
  pixKey: { type: String, trim: true },
  pixKeyType: { type: String, enum: ITAU_PIX_KEY_TYPES },
  mensagemPix: { type: String, trim: true },

  // Beneficiário impresso no boleto
  nomeCobranca: { type: String, trim: true },
  documento: { type: String, trim: true },          // CNPJ do beneficiário
  endereco: { type: BeneficiarioEnderecoSchema, default: () => ({}) },

  // Instruções / encargos padrão do boleto
  jurosPercent: { type: Number, default: 0, min: 0 },     // % ao mês
  multaPercent: { type: Number, default: 0, min: 0 },     // % sobre o valor
  diasBaixaAutomatica: { type: Number, default: 60, min: 0 },
  instrucoes: { type: String, trim: true },

  // Numeração do "nosso número" (controle interno do beneficiário)
  proximoNossoNumero: { type: Number, default: 1, min: 1 },

  // Gate do botão "Imprimir Fatura" em Contas a Receber
  isActive: { type: Boolean, default: false, index: true },

  // Resultado do último "Testar conexão"
  testedAt: { type: Date },
  testOk: { type: Boolean, default: false }
}, { timestamps: true });

// Avança e devolve o próximo "nosso número" de forma atômica.
ItauConfigSchema.statics.allocateNextNossoNumero = async function (companyId) {
  const updated = await this.findOneAndUpdate(
    { companyId },
    { $inc: { proximoNossoNumero: 1 } },
    { new: false }
  );
  if (!updated) throw new Error('Configuração Itaú não encontrada para a empresa');
  return updated.proximoNossoNumero;
};

// Config completa o suficiente para emitir boletos?
ItauConfigSchema.methods.isComplete = function () {
  return !!(
    this.clientId &&
    this.clientSecretEnc &&
    this.certificate?.storagePath &&
    this.privateKey?.storagePath &&
    this.agencia &&
    this.conta &&
    this.carteira &&
    this.pixKey
  );
};

export default mongoose.model('ItauConfig', ItauConfigSchema);
