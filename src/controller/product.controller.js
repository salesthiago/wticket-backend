import logger from '../utils/logger.js';
import productRepository from '../repositories/product.repository.js';
import * as s3Service from '../services/storage/s3.service.js';

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
    let storageKey, storageBucket, storageSource;

  
    if (req.file) {
      const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
      url = `${baseUrl}/uploads/products/${req.file.filename}`;
      filename = req.file.originalname;
      mimetype = req.file.mimetype;
      size = req.file.size;
      altText = req.body.altText;
      order = req.body.order;

      // Nome único + extensão original (preserva legibilidade)
      const ts = Date.now();
      const rand = Math.round(Math.random() * 1e9);
      const ext = (filename.match(/\.([A-Za-z0-9]+)$/)?.[1] || 'bin').toLowerCase();
      const baseName = filename.replace(/\.[^.]+$/, '');
      const objectName = `${ts}-${rand}-${baseName}.${ext}`;

      try {
        const result = await s3Service.uploadObject({
          companyId,
          category: `products/${id}`,
          filename: objectName,
          body: req.file.buffer,
          contentType: mimetype,
          publicRead: true
        });
        url = result.url;
        storageKey = result.key;
        storageBucket = result.bucket;
        storageSource = result.source;
      } catch (uploadErr) {
        logger.error('ProductController :: addImage S3 upload >> ', uploadErr);
        return res.status(500).json({
          message: uploadErr?.message || 'Falha ao enviar imagem ao S3'
        });
      }
    } else {
      // URL externa fornecida diretamente (sem upload de arquivo)
      ({ url, filename, mimetype, size, altText, order } = req.body);
      storageSource = 'local'; // marcador: não está no nosso S3
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
      order: order ?? 0,
      storageKey,
      storageBucket,
      storageSource,
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

    // Busca primeiro para conhecer a chave no S3 antes de remover do banco
    const existing = await productRepository.findImageById(companyId, imageId);
    if (!existing) return res.status(404).json({ message: 'Image not found' });

    // Best-effort: tenta apagar do S3, mas não bloqueia a remoção do registro
    if (existing.storageKey && (existing.storageSource === 'company' || existing.storageSource === 'default')) {
      try {
        await s3Service.deleteObject({ companyId, key: existing.storageKey });
      } catch (s3Err) {
        logger.warn('ProductController :: deleteImage S3 delete failed >> ', s3Err?.message);
      }
    }

    await productRepository.deleteImage(companyId, imageId);
    const image = await productRepository.deleteImage(companyId, imageId);
    if (!image) return res.status(404).json({ message: 'Image not found' });

    return res.status(200).json({ message: 'Image deleted successfully' });
  } catch (err) {
    logger.error('ProductController :: deleteImage >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
