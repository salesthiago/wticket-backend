import logger from '../utils/logger.js';
import leadRepository from '../repositories/lead.repository.js';
import serviceOrderRepository from '../repositories/service-order.repository.js';
import { storeOsPhoto } from './service-order.controller.js';

// API de integração externa (autenticada por x-api-key — ver
// middleware/api-key.middleware.js). req.companyId vem da chave.

const leadSummary = (lead) => ({
  id: lead._id,
  externalId: lead.externalId || null,
  name: lead.name,
  phone: lead.phone,
  status: lead.status,
  customerId: lead.convertedTo?._id || lead.convertedTo || null,
  createdAt: lead.createdAt
});

const orderSummary = (order) => ({
  id: order._id,
  orderNumber: order.orderNumber,
  status: order.status,
  photos: order.photos?.length || 0,
  createdAt: order.createdAt
});

// POST /integrations/leads — JSON ou multipart/form-data (fotos no campo "photos").
// Cria (ou reaproveita, pelo telefone) o lead. Com `description`, abre também
// o orçamento: uma OS "Aberta" no nome do lead, com as fotos anexadas.
export const createLead = async (req, res) => {
  try {
    const companyId = req.companyId;
    const name = req.body?.name?.trim();
    const phone = req.body?.phone?.trim();
    const email = req.body?.email?.trim() || undefined;
    const description = req.body?.description?.trim() || undefined;
    const externalId = req.body?.externalId ? String(req.body.externalId).trim() : undefined;
    const files = req.files || [];

    if (!name || !phone) {
      return res.status(422).json({ message: 'Fields name and phone are required' });
    }
    if (files.length && !description) {
      return res.status(422).json({ message: 'Field description is required when sending photos' });
    }

    // Idempotência: o mesmo externalId nunca gera um segundo lead/orçamento.
    if (externalId) {
      const existing = await leadRepository.findByExternalId(companyId, externalId);
      if (existing) {
        const orders = await serviceOrderRepository.findByLead(companyId, existing._id);
        return res.status(200).json({
          duplicate: true,
          lead: leadSummary(existing),
          serviceOrder: orders[0] ? orderSummary(orders[0]) : null
        });
      }
    }

    // Mesmo telefone: novo contato de um lead já existente (ex.: novo problema).
    let lead = externalId ? null : await leadRepository.findReusableByPhone(companyId, phone);
    const leadCreated = !lead;
    if (!lead) {
      lead = await leadRepository.create({
        companyId,
        name,
        phone,
        email,
        description,
        externalId,
        source: 'api'
      });
    }

    let serviceOrder = null;
    if (description) {
      const customerId = lead.status === 'converted' ? lead.convertedTo : undefined;
      serviceOrder = await serviceOrderRepository.create({
        companyId,
        leadId: lead._id,
        customerId,
        source: 'api',
        equipment: {},
        reportedIssue: description,
        statusHistory: [{ status: 'open', notes: 'Orçamento solicitado via API' }]
      });

      for (const [index, file] of files.entries()) {
        try {
          const photo = await storeOsPhoto({ companyId, serviceOrderId: serviceOrder._id, file, req });
          photo.order = index;
          serviceOrder = await serviceOrderRepository.addPhoto(companyId, serviceOrder._id, photo);
        } catch (uploadErr) {
          // Uma foto com falha não derruba o orçamento já criado.
          logger.error('IntegrationController :: createLead photo upload >> ', uploadErr);
        }
      }
    }

    return res.status(leadCreated || serviceOrder ? 201 : 200).json({
      duplicate: false,
      lead: leadSummary(lead),
      serviceOrder: serviceOrder ? orderSummary(serviceOrder) : null
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'A lead with this externalId is already being created' });
    }
    logger.error('IntegrationController :: createLead >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /integrations/leads/:externalId — acompanhamento pelo sistema de origem.
export const findLeadByExternalId = async (req, res) => {
  try {
    const companyId = req.companyId;
    const lead = await leadRepository.findByExternalId(companyId, req.params.externalId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const orders = await serviceOrderRepository.findByLead(companyId, lead._id);
    return res.status(200).json({
      lead: leadSummary(lead),
      serviceOrders: orders.map(orderSummary)
    });
  } catch (err) {
    logger.error('IntegrationController :: findLeadByExternalId >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
