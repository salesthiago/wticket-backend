import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  ncmCode: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  mainImage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductImage'
  },
  images: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductImage'
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isVirtual: {
    type: Boolean,
    default: false
  },
  service: {
    type: Boolean,
    default: false
  },
  trackStock: {
    type: Boolean,
    default: true
  },
  downloadUrl: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ companyId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ companyId: 1, isActive: 1, createdAt: -1 });

export default mongoose.model('Product', ProductSchema);
