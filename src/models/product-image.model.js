import mongoose from 'mongoose';

const ProductImageSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  // Opcional: imagens no S3 privado não têm URL pública persistida.
  // A URL é gerada sob demanda (pré-assinada) a partir de storageKey.
  // Mantida para imagens locais/externas (storageSource='local').
  url: {
    type: String,
    trim: true
  },
  // Localização no S3 — quando o objeto foi armazenado lá. Imagens antigas
  // (anteriores à migração) ficam com storageSource='local' e seguem
  // servidas do disco via /uploads/products/...
  storageKey: { type: String, trim: true },
  storageBucket: { type: String, trim: true },
  storageSource: { type: String, enum: ['company', 'default', 'local'], default: 'local' },
  filename: {
    type: String,
    trim: true
  },
  mimetype: {
    type: String,
    trim: true
  },
  size: {
    type: Number
  },
  altText: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

ProductImageSchema.index({ product: 1, order: 1 });

export default mongoose.model('ProductImage', ProductImageSchema);
