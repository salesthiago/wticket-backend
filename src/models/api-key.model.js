import mongoose from 'mongoose';

// Chave de API por empresa (tenant) para integrações externas — ex.: site ou
// landing page da empresa enviando leads/pedidos de orçamento. A chave em
// claro só é exibida uma vez, na criação; aqui fica apenas o hash SHA-256.
const ApiKeySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  // Primeiros caracteres da chave, para o usuário identificá-la na listagem.
  keyPrefix: { type: String, required: true, trim: true },
  keyHash: { type: String, required: true, unique: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

ApiKeySchema.index({ companyId: 1, revokedAt: 1, createdAt: -1 });

export default mongoose.model('ApiKey', ApiKeySchema);
