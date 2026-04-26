import logger from '../utils/logger.js';
import productRepository from '../repositories/product.repository.js';

// ─── Products ──────────────────────────────────────────────────────────────────

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, isActive, page, limit } = req.query;

    const result = await productRepository.findAll(companyId, {
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 10
    });

    return res.status(200).json(result);
  } catch (err) {
    logger.error('ProductController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const product = await productRepository.findById(companyId, id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.status(200).json(product);
  } catch (err) {
    logger.error('ProductController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { name, sku, ncmCode, description, price, stock, isActive, isVirtual, trackStock, downloadUrl } = req.body;

    if (!name || !sku || price === undefined) {
      return res.status(422).json({ message: 'Fields name, sku and price are required' });
    }

    const existing = await productRepository.findBySku(companyId, sku);
    if (existing) {
      return res.status(409).json({ message: 'SKU already in use' });
    }

    const product = await productRepository.create({
      companyId,
      name,
      sku,
      ncmCode,
      description,
      price,
      stock: stock ?? 0,
      isActive: isActive !== undefined ? isActive : true,
      isVirtual: isVirtual ?? false,
      trackStock: trackStock !== undefined ? trackStock : true,
      downloadUrl: downloadUrl || undefined
    });

    return res.status(201).json(product);
  } catch (err) {
    logger.error('ProductController :: create >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const body = req.body;

    if (!body || Object.keys(body).length === 0) {
      return res.status(422).json({ message: 'Body is empty' });
    }

    const product = await productRepository.update(companyId, id, body);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.status(200).json(product);
  } catch (err) {
    logger.error('ProductController :: update >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateStock = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || isNaN(quantity)) {
      return res.status(422).json({ message: 'Field quantity is required and must be a number' });
    }

    const product = await productRepository.updateStock(companyId, id, parseInt(quantity));
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.status(200).json(product);
  } catch (err) {
    logger.error('ProductController :: updateStock >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const product = await productRepository.delete(companyId, id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    logger.error('ProductController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Product Images ────────────────────────────────────────────────────────────

export const getImages = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const images = await productRepository.findImagesByProduct(companyId, id);
    return res.status(200).json(images);
  } catch (err) {
    logger.error('ProductController :: getImages >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addImage = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    let url, filename, mimetype, size, altText, order;

    if (req.file) {
      const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
      url = `${baseUrl}/uploads/products/${req.file.filename}`;
      filename = req.file.originalname;
      mimetype = req.file.mimetype;
      size = req.file.size;
      altText = req.body.altText;
      order = req.body.order;
    } else {
      ({ url, filename, mimetype, size, altText, order } = req.body);
    }

    if (!url) {
      return res.status(422).json({ message: 'Image file or url is required' });
    }

    const image = await productRepository.addImage({
      companyId,
      product: id,
      url,
      filename,
      mimetype,
      size,
      altText,
      order: order ?? 0
    });

    return res.status(201).json(image);
  } catch (err) {
    logger.error('ProductController :: addImage >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const setMainImage = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id, imageId } = req.params;

    const product = await productRepository.setMainImage(companyId, id, imageId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.status(200).json(product);
  } catch (err) {
    logger.error('ProductController :: setMainImage >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { imageId } = req.params;

    const image = await productRepository.deleteImage(companyId, imageId);
    if (!image) return res.status(404).json({ message: 'Image not found' });

    return res.status(200).json({ message: 'Image deleted successfully' });
  } catch (err) {
    logger.error('ProductController :: deleteImage >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
