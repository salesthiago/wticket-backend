import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { uploadProductImage } from '../middleware/upload.middleware.js';
import * as productController from '../controller/product.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('service_order'));

// Products
router.get('/', productController.findAll);
router.post('/', productController.create);
router.get('/:id', productController.findById);
router.put('/:id', productController.update);
router.patch('/:id/stock', productController.updateStock);
router.delete('/:id/destroy', productController.destroy);

// Product Images
router.get('/:id/images', productController.getImages);
router.post('/:id/images', uploadProductImage, productController.addImage);
router.patch('/:id/images/:imageId/main', productController.setMainImage);
router.delete('/images/:imageId/destroy', productController.deleteImage);

export default router;
