import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadProductImage } from '../middleware/upload.middleware.js';
import * as productController from '../controller/product.controller.js';

const router = Router();

// Products
router.get('/', authenticate, productController.findAll);
router.post('/', authenticate, productController.create);
router.get('/:id', authenticate, productController.findById);
router.put('/:id', authenticate, productController.update);
router.patch('/:id/stock', authenticate, productController.updateStock);
router.delete('/:id/destroy', authenticate, productController.destroy);

// Product Images
router.get('/:id/images', authenticate, productController.getImages);
router.post('/:id/images', authenticate, uploadProductImage, productController.addImage);
router.patch('/:id/images/:imageId/main', authenticate, productController.setMainImage);
router.delete('/images/:imageId/destroy', authenticate, productController.deleteImage);

export default router;
