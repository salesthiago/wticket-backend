import Product from '../models/product.model.js';
import ProductImage from '../models/product-image.model.js';
import logger from '../utils/logger.js';

class ProductRepository {
  async create(data) {
    try {
      const product = new Product(data);
      return await product.save();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findAll({ search, isActive, page = 0, limit = 10 } = {}) {
    try {
      const query = {};

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
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findById(id) {
    try {
      return await Product.findById(id)
        .populate('mainImage')
        .populate('images');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findBySku(sku) {
    try {
      return await Product.findOne({ sku: sku.toUpperCase() });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async update(id, data) {
    try {
      return await Product.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true }
      ).populate('mainImage').populate('images');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async updateStock(id, quantity) {
    try {
      return await Product.findByIdAndUpdate(
        id,
        { $inc: { stock: quantity } },
        { new: true }
      );
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async delete(id) {
    try {
      return await Product.findByIdAndDelete(id);
    } catch (error) {
      logger.error('ProductRepository :: delete >> ', error);
      throw new Error(error.message);
    }
  }

  // Product Images
  async addImage(imageData) {
    try {
      const image = new ProductImage(imageData);
      const saved = await image.save();
      await Product.findByIdAndUpdate(
        imageData.product,
        { $push: { images: saved._id } }
      );
      return saved;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async setMainImage(productId, imageId) {
    try {
      return await Product.findByIdAndUpdate(
        productId,
        { $set: { mainImage: imageId } },
        { new: true }
      ).populate('mainImage');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findImagesByProduct(productId) {
    try {
      return await ProductImage.find({ product: productId }).sort({ order: 1 });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async deleteImage(imageId) {
    try {
      const image = await ProductImage.findByIdAndDelete(imageId);
      if (image) {
        await Product.findByIdAndUpdate(
          image.product,
          { $pull: { images: imageId } }
        );
      }
      return image;
    } catch (error) {
      logger.error('ProductRepository :: deleteImage >> ', error);
      throw new Error(error.message);
    }
  }
}

export default new ProductRepository();
