import mongoose from 'mongoose';

const ProductImageSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
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
