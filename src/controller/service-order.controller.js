import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import serviceOrderRepository from '../repositories/service-order.repository.js';
import customerRepository from '../repositories/customer.repository.js';
import vehicleRepository from '../repositories/vehicle.repository.js';
import companyRepository from '../repositories/company.repository.js';
import receivableService from '../services/financial/receivable.service.js';
import stockService from '../services/stock.service.js';
import * as s3Service from '../services/storage/s3.service.js';
import { buildServiceOrderPdf } from '../services/service-order-pdf.service.js';

// Atualiza o KM (mileage) do veículo sempre que informado em uma OS.
// Aceita vehicleId como ObjectId/string ou como documento populado.
const syncVehicleMileage = async (companyId, vehicleId, mileage) => {
  const id = vehicleId && typeof vehicleId === 'object' ? (vehicleId._id || vehicleId.id) : vehicleId;
  if (!id || mileage === undefined || mileage === null || mileage === '') return;
  const km = Number(mileage);
  if (Number.isNaN(km) || km < 0) return;
  try {
    await vehicleRepository.update(companyId, id, { mileage: km });
  } catch (err) {
    logger.warn('ServiceOrderController :: syncVehicleMileage >> ', err?.message);
  }
};

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, status, priority, technicianId, customerId, page, limit } = req.query;

    const result = await serviceOrderRepository.findAll(companyId, {
      search,
      status,
      priority,
      technicianId,
      customerId,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 10
    });

    return res.status(200).json(result);
  } catch (err) {
    logger.error('ServiceOrderController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const serviceOrder = await serviceOrderRepository.findById(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    return res.status(200).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findByOrderNumber = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { orderNumber } = req.params;

    const serviceOrder = await serviceOrderRepository.findByOrderNumber(companyId, orderNumber);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    return res.status(200).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: findByOrderNumber >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findByCustomer = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { customerId } = req.params;

    const orders = await serviceOrderRepository.findByCustomer(companyId, customerId);
    return res.status(200).json(orders);
  } catch (err) {
    logger.error('ServiceOrderController :: findByCustomer >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { customerId, vehicleId, equipment, reportedIssue, priority, technicianId, estimatedCompletionDate, internalNotes } = req.body;

    if (!customerId || !equipment?.type || !reportedIssue) {
      return res.status(422).json({
        message: 'Fields customerId, equipment.type and reportedIssue are required'
      });
    }

    const customer = await customerRepository.findById(companyId, customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const serviceOrder = await serviceOrderRepository.create({
      companyId,
      customerId,
      vehicleId: vehicleId || undefined,
      equipment,
      reportedIssue,
      priority,
      technicianId,
      estimatedCompletionDate,
      internalNotes,
      statusHistory: [{
        status: 'open',
        changedBy: req.user.sub,
        notes: 'Ordem de serviço criada'
      }]
    });

    // Ajusta o KM do veículo com o valor informado na OS.
    await syncVehicleMileage(companyId, serviceOrder.vehicleId, serviceOrder.equipment?.mileage);

    return res.status(201).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: create >> ', err);
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

    delete body.status;
    delete body.statusHistory;
    delete body.orderNumber;

    const serviceOrder = await serviceOrderRepository.update(companyId, id, body);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    // Ajusta o KM do veículo sempre que informado na OS.
    await syncVehicleMileage(companyId, serviceOrder.vehicleId, serviceOrder.equipment?.mileage);

    return res.status(200).json(serviceOrder);
  } catch (err) {
    logger.error('ServiceOrderController :: update >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) return res.status(422).json({ message: 'Status is required' });

    const validStatuses = ['open', 'diagnosing', 'quoted', 'approved', 'in_progress', 'completed', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(422).json({ message: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    const serviceOrder = await serviceOrderRepository.findById(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    const updateData = { status };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      if (serviceOrder.warrantyDays > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + serviceOrder.warrantyDays);
        updateData.warrantyExpiresAt = expiresAt;
      }
    }

    if (status === 'cancelled') {
      updateData.cancelReason = notes || '';
      // Devolve ao estoque tudo que foi baixado pelas peças desta OS.
      if (serviceOrder.parts?.length) {
        await stockService.reverseServiceOrderParts({
          companyId,
          serviceOrderId: id,
          orderNumber: serviceOrder.orderNumber,
          parts: serviceOrder.parts,
          userId: req.user.sub
        });
        updateData.parts = serviceOrder.parts.map(p => ({
          ...(p.toObject ? p.toObject() : p),
          deductedQuantity: 0
        }));
      }
    }

    await serviceOrderRepository.update(companyId, id, updateData);
    await serviceOrderRepository.addStatusHistory(companyId, id, {
      status,
      changedBy: req.user.sub,
      notes: notes || ''
    });

    const updated = await serviceOrderRepository.findById(companyId, id);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ServiceOrderController :: updateStatus >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addDiagnosis = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { diagnosis, services, parts, estimatedCost } = req.body;

    if (!diagnosis) return res.status(422).json({ message: 'Diagnosis is required' });

    const serviceOrder = await serviceOrderRepository.findById(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    const updateData = { diagnosis };
    if (services) updateData.services = services;
    if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost;

    // Peças: reconcilia o estoque (baixa/estorno por delta) antes de salvar.
    // Bloqueia (409) se faltar saldo em algum produto vinculado.
    if (parts) {
      updateData.parts = await stockService.reconcileServiceOrderParts({
        companyId,
        serviceOrderId: id,
        orderNumber: serviceOrder.orderNumber,
        oldParts: serviceOrder.parts || [],
        newParts: parts,
        userId: req.user.sub
      });
    }

    await serviceOrderRepository.update(companyId, id, updateData);

    const updated = await serviceOrderRepository.findById(companyId, id);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ServiceOrderController :: addDiagnosis >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const dashboard = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const statusCounts = await serviceOrderRepository.countByStatus(companyId);

    const summary = {
      open: 0,
      diagnosing: 0,
      quoted: 0,
      approved: 0,
      in_progress: 0,
      completed: 0,
      delivered: 0,
      cancelled: 0,
      total: 0
    };

    statusCounts.forEach(item => {
      summary[item._id] = item.count;
      summary.total += item.count;
    });

    return res.status(200).json(summary);
  } catch (err) {
    logger.error('ServiceOrderController :: dashboard >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Faturamento ──────────────────────────────────────────────────────────────

export const invoice = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const { id } = req.params;

    // Bloqueio de role aqui também (controller é alcançado via rotas de service-orders,
    // que não exigem role financeira). Permitimos administrator e finance.
    const role = req.user.role;
    if (!['super_admin', 'administrator', 'finance'].includes(role)) {
      return res.status(403).json({ message: 'Apenas usuários com role administrator ou finance podem faturar.' });
    }

    // Bloqueio de módulo: empresa precisa ter o módulo financial ativo
    const modules = req.user.modules || [];
    if (!modules.includes('financial')) {
      return res.status(403).json({ message: 'Módulo financeiro não está ativo para esta empresa.' });
    }

    const doc = await receivableService.invoiceFromServiceOrder({
      companyId,
      userId,
      serviceOrderId: id,
      data: req.body || {}
    });
    return res.status(201).json(doc);
  } catch (err) {
    logger.error('ServiceOrderController :: invoice >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      details: err.details
    });
  }
};

export const listReceivables = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const list = await receivableService.listByServiceOrder(companyId, id);
    return res.status(200).json(list);
  } catch (err) {
    logger.error('ServiceOrderController :: listReceivables >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    // Carrega antes do soft delete para conhecer as peças baixadas.
    const existing = await serviceOrderRepository.findById(companyId, id);

    const serviceOrder = await serviceOrderRepository.softDelete(companyId, id);
    if (!serviceOrder) return res.status(404).json({ message: 'Service order not found' });

    // Devolve ao estoque as peças que tinham baixa registrada.
    if (existing?.parts?.length) {
      await stockService.reverseServiceOrderParts({
        companyId,
        serviceOrderId: id,
        orderNumber: existing.orderNumber,
        parts: existing.parts,
        userId: req.user.sub
      });
    }

    return res.status(200).json({ message: 'Service order deleted successfully' });
  } catch (err) {
    logger.error('ServiceOrderController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Impressão em PDF ───────────────────────────────────────────────────────────

export const exportPdf = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const order = await serviceOrderRepository.findById(companyId, id);
    if (!order) return res.status(404).json({ message: 'Service order not found' });

    const company = await companyRepository.findById(companyId);

    const buffer = await buildServiceOrderPdf({
      order: order.toObject ? order.toObject() : order,
      company: company ? (company.toObject ? company.toObject() : company) : null
    });

    const fname = `OS-${order.orderNumber || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fname}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.end(buffer);
  } catch (err) {
    logger.error('ServiceOrderController :: exportPdf >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Fotos da OS ────────────────────────────────────────────────────────────────

// Armazena o arquivo no S3 da empresa (quando configurado) ou no disco local.
const storeOsPhoto = async ({ companyId, serviceOrderId, file, req }) => {
  const ts = Date.now();
  const rand = Math.round(Math.random() * 1e9);
  const ext = (file.originalname.match(/\.([A-Za-z0-9]+)$/)?.[1] || 'jpg').toLowerCase();
  const objectName = `${ts}-${rand}.${ext}`;

  const useS3 = await s3Service.hasConfig(companyId);
  if (useS3) {
    const result = await s3Service.uploadObject({
      companyId,
      category: `service-orders/${serviceOrderId}`,
      filename: objectName,
      body: file.buffer,
      contentType: file.mimetype,
      publicRead: true
    });
    return {
      url: result.url,
      storageKey: result.key,
      storageBucket: result.bucket,
      storageSource: result.source,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    };
  }

  // Fallback local: grava em uploads/service-orders/<id> e serve por /uploads.
  const dir = path.join('uploads', 'service-orders', String(serviceOrderId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, objectName), file.buffer);
  const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
  return {
    url: `${baseUrl}/uploads/service-orders/${serviceOrderId}/${objectName}`,
    storageSource: 'local',
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  };
};

export const getPhotos = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const order = await serviceOrderRepository.findById(companyId, id);
    if (!order) return res.status(404).json({ message: 'Service order not found' });
    return res.status(200).json(order.photos || []);
  } catch (err) {
    logger.error('ServiceOrderController :: getPhotos >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addPhoto = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    if (!req.file) {
      return res.status(422).json({ message: 'Photo file is required' });
    }

    const order = await serviceOrderRepository.findById(companyId, id);
    if (!order) return res.status(404).json({ message: 'Service order not found' });

    let photo;
    try {
      photo = await storeOsPhoto({ companyId, serviceOrderId: id, file: req.file, req });
    } catch (uploadErr) {
      logger.error('ServiceOrderController :: addPhoto upload >> ', uploadErr);
      return res.status(500).json({ message: uploadErr?.message || 'Falha ao enviar foto' });
    }

    photo.order = order.photos?.length || 0;
    const updated = await serviceOrderRepository.addPhoto(companyId, id, photo);
    return res.status(201).json(updated.photos);
  } catch (err) {
    logger.error('ServiceOrderController :: addPhoto >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deletePhoto = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id, photoId } = req.params;

    const photo = await serviceOrderRepository.findPhoto(companyId, id, photoId);
    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    // Best-effort: remove do S3 quando aplicável (não bloqueia a remoção do registro).
    if (photo.storageKey && (photo.storageSource === 'company' || photo.storageSource === 'default')) {
      try {
        await s3Service.deleteObject({ companyId, key: photo.storageKey });
      } catch (s3Err) {
        logger.warn('ServiceOrderController :: deletePhoto S3 delete failed >> ', s3Err?.message);
      }
    }

    const updated = await serviceOrderRepository.removePhoto(companyId, id, photoId);
    if (!updated) return res.status(404).json({ message: 'Service order not found' });

    return res.status(200).json(updated.photos);
  } catch (err) {
    logger.error('ServiceOrderController :: deletePhoto >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
