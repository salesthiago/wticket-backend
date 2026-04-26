import Product from '../models/product.model.js';
import ProductImage from '../models/product-image.model.js';
import logger from '../utils/logger.js';

class ProductRepository {
  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    const product = new Product(data);
    return await product.save();
  }

  async findAll(companyId, { search, isActive, page = 0, limit = 10 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const query = { companyId };

    if (typeof isActive === 'boolean') {
      query.isActive = isActive;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { ncmCode: { $regex: search, $options: 'i' } }
      ];
    }

    const [records, total] = await Promise.all([
      Product.find(query)
        .populate('mainImage')
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .exec(),
      Product.countDocuments(query)
    ]);

    return { records, total, page, limit };
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await Product.findOne({ _id: id, companyId })
      .populate('mainImage')
      .populate('images');
  }

  async findBySku(companyId, sku) {
    if (!companyId) throw new Error('companyId is required');
    return await Product.findOne({ companyId, sku: sku.toUpperCase() });
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await Product.findOneAndUpdate(
      { _id: id, companyId },
      { $set: patch },
      { new: true }
    ).populate('mainImage').populate('images');
  }

  async updateStock(companyId, id, quantity) {
    if (!companyId) throw new Error('companyId is required');
    return await Product.findOneAndUpdate(
      { _id: id, companyId },
      { $inc: { stock: quantity } },
      { new: true }
    );
  }

  async delete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    try {
      return await Product.findOneAndDelete({ _id: id, companyId });
    } catch (error) {
      logger.error('ProductRepository :: delete >> ', error);
      throw error;
    }
  }

  // Product Images
  async addImage(imageData) {
    if (!imageData.companyId) throw new Error('companyId is required');
    const image = new ProductImage(imageData);
    const saved = await image.save();
    await Product.findOneAndUpdate(
      { _id: imageData.product, companyId: imageData.companyId },
      { $push: { images: saved._id } }
    );
    return saved;
  }

  async setMainImage(companyId, productId, imageId) {
    if (!companyId) throw new Error('companyId is required');
    return await Product.findOneAndUpdate(
      { _id: productId, companyId },
      { $set: { mainImage: imageId } },
      { new: true }
    ).populate('mainImage');
  }

  async findImagesByProduct(companyId, productId) {
    if (!companyId) throw new Error('companyId is required');
    return await ProductImage.find({ companyId, product: productId }).sort({ order: 1 });
  }

  async deleteImage(companyId, imageId) {
    if (!companyId) throw new Error('companyId is required');
    try {
      const image = await ProductImage.findOneAndDelete({ _id: imageId, companyId });
      if (image) {
        await Product.findOneAndUpdate(
          { _id: image.product, companyId },
          { $pull: { images: imageId } }
        );
      }
      return image;
    } catch (error) {
      logger.error('ProductRepository :: deleteImage >> ', error);
      throw error;
    }
  }
}

export default new ProductRepository();
