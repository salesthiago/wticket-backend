import logger from '../utils/logger.js';
import productRepository from '../repositories/product.repository.js';
import stockMovementRepository from '../repositories/stock-movement.repository.js';
import stockService from '../services/stock.service.js';
import * as s3Service from '../services/storage/s3.service.js';

// Gera um SKU único por empresa quando o usuário não informa um.
// Formato: PRD-XXXXXX (produto) ou SRV-XXXXXX (serviço), em base36 maiúsculo.
async function generateUniqueSku(companyId, prefix = 'PRD') {
  for (let i = 0; i < 6; i++) {
    const rand = Math.floor(Math.random() * 36 ** 4).toString(36).toUpperCase().padStart(4, '0');
    const candidate = `${prefix}-${Date.now().toString(36).toUpperCase().slice(-4)}${rand}`;
    const existing = await productRepository.findBySku(companyId, candidate);
    if (!existing) return candidate;
  }
  // Fallback improvável de colisão repetida
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// Imagens são privadas no S3. A permissão de leitura é concedida apenas no
// momento da requisição, gerando uma URL pré-assinada válida por 1 hora.
async function presignImage(companyId, image) {
  if (!image) return image;
  const obj = typeof image.toObject === 'function' ? image.toObject() : { ...image };
  if (obj.storageKey && obj.storageSource !== 'local') {
    try {
      obj.url = await s3Service.getPresignedUrl({ companyId, key: obj.storageKey, expiresIn: 60 * 60 });
    } catch (err) {
      logger.warn('ProductController :: falha ao gerar URL pré-assinada da imagem >> ', err?.message);
      obj.url = null;
    }
  }
  return obj;
}

// Aplica presignImage à mainImage e à lista images (quando populadas).
async function presignProduct(companyId, product) {
  if (!product) return product;
  const obj = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  if (obj.mainImage && typeof obj.mainImage === 'object') {
    obj.mainImage = await presignImage(companyId, obj.mainImage);
  }
  if (Array.isArray(obj.images)) {
    obj.images = await Promise.all(
      obj.images.map(img => (img && typeof img === 'object') ? presignImage(companyId, img) : img)
    );
  }
  return obj;
}

// ─── Products ──────────────────────────────────────────────────────────────────

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, isActive, service, page, limit } = req.query;

    const result = await productRepository.findAll(companyId, {
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      service: service !== undefined ? service === 'true' : undefined,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 10
    });

    result.records = await Promise.all(
      (result.records || []).map(r => presignProduct(companyId, r))
    );
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

    return res.status(200).json(await presignProduct(companyId, product));
  } catch (err) {
    logger.error('ProductController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { name, sku, ncmCode, brand, model, description, price, stock, isActive, isVirtual, service, trackStock, downloadUrl } = req.body;

    if (!name || price === undefined) {
      return res.status(422).json({ message: 'Fields name and price are required' });
    }

    // SKU é opcional: se não informado, gera um código único automaticamente.
    let finalSku = (sku || '').trim();
    if (finalSku) {
      const existing = await productRepository.findBySku(companyId, finalSku);
      if (existing) {
        return res.status(409).json({ message: 'SKU already in use' });
      }
    } else {
      finalSku = await generateUniqueSku(companyId, service ? 'SRV' : 'PRD');
    }

    const product = await productRepository.create({
      companyId,
      name,
      sku: finalSku,
      ncmCode,
      brand: brand || undefined,
      model: model || undefined,
      description,
      price,
      stock: stock ?? 0,
      isActive: isActive !== undefined ? isActive : true,
      isVirtual: isVirtual ?? false,
      service: service ?? false,
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
    const userId = req.user.sub;
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || isNaN(quantity)) {
      return res.status(422).json({ message: 'Field quantity is required and must be a number' });
    }

    const delta = parseInt(quantity);
    if (delta === 0) {
      return res.status(422).json({ message: 'Quantity must not be zero' });
    }

    const { product } = await stockService.registerMovement({
      companyId,
      productId: id,
      type: delta > 0 ? 'in' : 'out',
      quantity: Math.abs(delta),
      reason: 'adjustment',
      notes: req.body.notes,
      userId
    });

    return res.status(200).json(product);
  } catch (err) {
    logger.error('ProductController :: updateStock >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

// ─── Stock Movements ─────────────────────────────────────────────────────────

export const createStockMovement = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const { id } = req.params;
    const { type, quantity, notes } = req.body;

    if (!['in', 'out'].includes(type)) {
      return res.status(422).json({ message: 'Field type must be "in" or "out"' });
    }
    if (quantity === undefined || isNaN(quantity) || Number(quantity) <= 0) {
      return res.status(422).json({ message: 'Field quantity is required and must be greater than zero' });
    }

    const { product, movement } = await stockService.registerMovement({
      companyId,
      productId: id,
      type,
      quantity: Number(quantity),
      reason: type === 'in' ? 'manual_in' : 'manual_out',
      notes,
      userId
    });

    return res.status(201).json({ product, movement });
  } catch (err) {
    logger.error('ProductController :: createStockMovement >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const listStockMovements = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { page, limit } = req.query;

    const result = await stockMovementRepository.findByProduct(companyId, id, {
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 20
    });

    return res.status(200).json(result);
  } catch (err) {
    logger.error('ProductController :: listStockMovements >> ', err);
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
    const out = await Promise.all(images.map(img => presignImage(companyId, img)));
    return res.status(200).json(out);
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
        // Upload PRIVADO (sem ACL pública). A URL é gerada sob demanda (presigned).
        const result = await s3Service.uploadObject({
          companyId,
          category: `products/${id}`,
          filename: objectName,
          body: req.file.buffer,
          contentType: mimetype
        });
        storageKey = result.key;
        storageBucket = result.bucket;
        storageSource = result.source;
        // url permanece indefinida — não persistimos URL pública.
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

    if (!req.file && !url) {
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
      storageKey,
      storageBucket,
      storageSource,
      order: order ?? 0
    });

    return res.status(201).json(await presignImage(companyId, image));
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

    return res.status(200).json(await presignProduct(companyId, product));
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
