import fs from "fs";
import path from "path";
import logger from "../utils/logger.js";
import * as s3Service from "../services/storage/s3.service.js";
import ticketRepository from "../repositories/ticket.repository.js";
import ticketStatusRepository from "../repositories/ticket-status.repository.js";
import customerRepository from "../repositories/customer.repository.js";
import projectRepository from "../repositories/project.repository.js";
import userRepository from "../repositories/user.repository.js";

// Acesso de cliente ("portal"): quando o usuário logado tem customerId
// vinculado, ele só pode ver/mexer em tickets ligados diretamente a esse
// cliente ou aos projetos desse cliente.
function ticketBelongsToScope(ticket, scopeCustomerId) {
  if (!scopeCustomerId) return true;
  const ticketCustomerId = (ticket.customerId?._id || ticket.customerId)?.toString();
  const projectCustomerId = ticket.projectId?.customerId?.toString();
  return ticketCustomerId === scopeCustomerId || projectCustomerId === scopeCustomerId;
}

// Exclusão de tarefa/resposta: liberada para quem criou o registro ou para
// administradores (administrator/company_admin/super_admin).
const ADMIN_ROLES = ['administrator', 'company_admin', 'super_admin'];
function canDelete(ownerId, req) {
  if (ADMIN_ROLES.includes(req.user?.role)) return true;
  if (!ownerId) return false;
  const userId = req.user?.sub;
  return userId && ownerId.toString() === userId.toString();
}

async function getScopeProjectIds(companyId, scopeCustomerId) {
  if (!scopeCustomerId) return [];
  const projects = await projectRepository.findAll({ companyId, customerId: scopeCustomerId });
  return projects.map(p => p._id);
}

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { categoryId, statusId, assignedTo } = req.query;

    let scopeProjectIds = null;
    if (scopeCustomerId) {
      scopeProjectIds = await getScopeProjectIds(companyId, scopeCustomerId);
    }

    const tickets = await ticketRepository.findAll({
      categoryId, statusId, assignedTo, companyId, scopeCustomerId, scopeProjectIds
    });
    return res.status(200).json(tickets);
  } catch (err) {
    logger.error("ticket findAll error >>> ", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const {
      contactNumber, contactName, categoryId, subjectId, statusId,
      priority, assignedTo, notes, tags, projectId, startDate, endDate
    } = req.body;
    let { customerId } = req.body;

    // Login de cliente só cria tickets/tarefas para si mesmo ou para um
    // projeto que pertença a ele.
    if (scopeCustomerId) {
      customerId = scopeCustomerId;
      if (projectId) {
        const project = await projectRepository.findById(projectId, { companyId });
        const projectCustomerId = (project?.customerId?._id || project?.customerId)?.toString();
        if (!project || projectCustomerId !== scopeCustomerId) {
          return res.status(422).json({ message: 'Projeto não pertence a este cliente' });
        }
      }
    }

    let resolvedStatusId = statusId;
    if (!resolvedStatusId) {
      const defaultStatus = await ticketStatusRepository.findDefault(companyId);
      if (defaultStatus) resolvedStatusId = defaultStatus._id;
    }

    // Quando um cliente é selecionado, deriva nome/telefone dele (em vez de
    // exigir digitação manual) mantendo o vínculo via customerId.
    let resolvedContactNumber = contactNumber;
    let resolvedContactName = contactName;
    if (customerId && companyId) {
      const customer = await customerRepository.findById(companyId, customerId);
      if (!customer) return res.status(422).json({ message: 'Cliente não encontrado' });
      resolvedContactNumber = customer.phone;
      resolvedContactName = customer.name;
    }

    const ticket = await ticketRepository.create({
      companyId,
      contactNumber: resolvedContactNumber,
      contactName: resolvedContactName,
      customerId: customerId || null,
      categoryId,
      subjectId,
      statusId: resolvedStatusId,
      priority,
      assignedTo,
      notes,
      tags,
      projectId: projectId || null,
      startDate,
      endDate,
      createdBy: req.user?.sub || null
    });

    return res.status(201).json(ticket);
  } catch (err) {
    logger.error("ticket create error >>> ", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSaleItems = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { saleItems, categoryId } = req.body;
    if (!id) return res.status(422).json({ message: 'ID not found' });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const data = {};
    if (saleItems !== undefined) data.saleItems = saleItems;
    if (categoryId !== undefined) data.categoryId = categoryId;

    const updated = await ticketRepository.update(id, data);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('updateSaleItems error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: "ID not found" });
    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    return res.status(200).json(ticket);
  } catch (err) {
    logger.error("ticket findById error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { statusId } = req.body;
    if (!id) return res.status(422).json({ message: "ID not found" });
    if (!statusId) return res.status(422).json({ message: "statusId not found" });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const updated = await ticketRepository.updateStatus(id, statusId);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket updateStatus error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Designar a tarefa para outro usuário: só administradores, e só para um
// usuário interno (sem customerId), já que login de cliente não deve
// aparecer como responsável por atendimento. Registra uma resposta
// automática no histórico para manter rastreabilidade da troca.
export const assignTicket = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;
    const { assignedTo } = req.body;
    if (!id) return res.status(422).json({ message: "ID not found" });
    if (!assignedTo) return res.status(422).json({ message: "assignedTo é obrigatório" });

    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: "Somente administradores podem designar a tarefa para outro usuário" });
    }

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, scopeCustomerId)) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const targetUser = await userRepository.findById(assignedTo, { companyId });
    if (!targetUser) {
      return res.status(422).json({ message: "Usuário não encontrado" });
    }
    if (targetUser.customerId) {
      return res.status(422).json({ message: "Não é possível designar a tarefa para um usuário vinculado a um cliente" });
    }

    await ticketRepository.assignTicket(id, assignedTo, { companyId });
    await ticketRepository.addResponse(id, {
      content: `Atribuído a ${targetUser.name}`,
      respondedBy: req.user?.sub,
      hoursSpent: 0
    });

    const updated = await ticketRepository.findById(id, { companyId });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket assignTicket error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addResponse = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { content, hoursSpent } = req.body;
    if (!id) return res.status(422).json({ message: "ID not found" });
    if (!content) return res.status(422).json({ message: "Conteúdo da resposta é obrigatório" });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const respondedBy = req.user?.sub || req.user?._id;
    const updated = await ticketRepository.addResponse(id, { content, respondedBy, hoursSpent });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket addResponse error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: "ID not found" });
    if (!req.body) return res.status(422).json({ message: "Body is empty" });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, scopeCustomerId)) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const patch = { ...req.body };
    if (scopeCustomerId) {
      // Login de cliente não pode reatribuir o ticket para fora do próprio escopo.
      delete patch.customerId;
      delete patch.projectId;
      delete patch.companyId;
    }

    const updated = await ticketRepository.update(id, patch);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket update error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: "ID not found" });

    const existing = await ticketRepository.findById(id, { companyId });
    if (!existing || !ticketBelongsToScope(existing, req.user?.customerId)) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const ownerId = existing.createdBy?._id || existing.createdBy;
    if (!canDelete(ownerId, req)) {
      return res.status(403).json({ message: 'Somente quem criou a tarefa ou um administrador pode excluí-la' });
    }

    const ticket = await ticketRepository.deleteTicket(id, { companyId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.status(200).json({ message: 'Ticket deletado com sucesso' });
  } catch (err) {
    logger.error("ticket destroy error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteResponse = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id, responseId } = req.params;
    if (!id || !responseId) return res.status(422).json({ message: 'ID not found' });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const response = ticket.responses.id(responseId);
    if (!response) return res.status(404).json({ message: 'Resposta não encontrada' });

    const ownerId = response.respondedBy?._id || response.respondedBy;
    if (!canDelete(ownerId, req)) {
      return res.status(403).json({ message: 'Somente quem registrou a resposta ou um administrador pode excluí-la' });
    }

    const updated = await ticketRepository.deleteResponse(id, responseId);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('ticket deleteResponse error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Edição do conteúdo do ticket (categoria, assunto, prioridade, observações):
// liberada apenas enquanto o ticket não tiver nenhuma resposta, para não
// alterar o contexto de uma tratativa já iniciada.
export const updateContent = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: "ID not found" });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    if (ticket.responses?.length > 0) {
      return res.status(409).json({ message: "O ticket já possui respostas e não pode mais ser editado" });
    }

    const { categoryId, subjectId, priority, notes } = req.body || {};
    const patch = {};
    if (categoryId !== undefined) patch.categoryId = categoryId || null;
    if (subjectId !== undefined) patch.subjectId = subjectId || null;
    if (priority !== undefined) patch.priority = priority;
    if (notes !== undefined) patch.notes = notes;

    await ticketRepository.update(id, patch);
    const updated = await ticketRepository.findById(id, { companyId });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket updateContent error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Anexos do Ticket ───────────────────────────────────────────────────────

// Armazena o arquivo no S3 da empresa (quando configurado) ou no disco local
// — mesmo padrão usado nos documentos de Projeto.
const storeTicketAttachment = async ({ companyId, ticketId, file, req, uploadedBy }) => {
  const ts = Date.now();
  const rand = Math.round(Math.random() * 1e9);
  const ext = (file.originalname.match(/\.([A-Za-z0-9]+)$/)?.[1] || 'dat').toLowerCase();
  const objectName = `${ts}-${rand}.${ext}`;

  const useS3 = await s3Service.hasConfig(companyId);
  if (useS3) {
    const result = await s3Service.uploadObject({
      companyId,
      category: `tickets/${ticketId}/attachments`,
      filename: objectName,
      body: file.buffer,
      contentType: file.mimetype
    });
    return {
      url: result.url,
      storageKey: result.key,
      storageBucket: result.bucket,
      storageSource: result.source,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedBy
    };
  }

  // Fallback local: grava em uploads/tickets/<id>/attachments e serve por /uploads.
  const dir = path.join('uploads', 'tickets', String(ticketId), 'attachments');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, objectName), file.buffer);
  const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
  return {
    url: `${baseUrl}/uploads/tickets/${ticketId}/attachments/${objectName}`,
    storageSource: 'local',
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    uploadedBy
  };
};

const ATTACHMENT_VIEW_EXPIRES_IN = 15 * 60; // 15 min

// URL de exibição: assinada (temporária) para objetos privados no S3, ou a
// URL já persistida para arquivos locais.
const enrichAttachments = async (companyId, attachments = []) => {
  return await Promise.all(
    attachments.map(async (a) => {
      const obj = a.toObject ? a.toObject() : { ...a };
      try {
        obj.viewUrl = obj.storageKey && (obj.storageSource === 'company' || obj.storageSource === 'default')
          ? await s3Service.getPresignedUrl({ companyId, key: obj.storageKey, expiresIn: ATTACHMENT_VIEW_EXPIRES_IN })
          : obj.url || null;
      } catch (err) {
        logger.warn('ticket enrichAttachments sign failed >>>', err?.message);
        obj.viewUrl = obj.url || null;
      }
      return obj;
    })
  );
};

export const getAttachments = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    return res.status(200).json(await enrichAttachments(companyId, ticket.attachments || []));
  } catch (err) {
    logger.error('ticket getAttachments error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addAttachment = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id } = req.params;

    if (!req.file) return res.status(422).json({ message: 'Arquivo é obrigatório' });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    let attachment;
    try {
      attachment = await storeTicketAttachment({
        companyId, ticketId: id, file: req.file, req, uploadedBy: req.user?.sub || null
      });
    } catch (uploadErr) {
      logger.error('ticket addAttachment upload error >>>', uploadErr);
      return res.status(500).json({ message: uploadErr?.message || 'Falha ao enviar anexo' });
    }

    const updated = await ticketRepository.addAttachment(id, attachment);
    return res.status(201).json(await enrichAttachments(companyId, updated.attachments || []));
  } catch (err) {
    logger.error('ticket addAttachment error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Remover anexo: quem enviou ou um administrador (mesma regra das respostas).
export const deleteAttachment = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const { id, attachmentId } = req.params;

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket || !ticketBelongsToScope(ticket, req.user?.customerId)) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const attachment = ticket.attachments.id(attachmentId);
    if (!attachment) return res.status(404).json({ message: 'Anexo não encontrado' });

    if (!canDelete(attachment.uploadedBy, req)) {
      return res.status(403).json({ message: 'Somente quem enviou o anexo ou um administrador pode excluí-lo' });
    }

    // Best-effort: remove o arquivo do armazenamento (não bloqueia a remoção do registro).
    try {
      if (attachment.storageKey && (attachment.storageSource === 'company' || attachment.storageSource === 'default')) {
        await s3Service.deleteObject({ companyId, key: attachment.storageKey });
      } else if (attachment.storageSource === 'local' && attachment.url) {
        const relative = attachment.url.split('/uploads/')[1];
        if (relative) fs.rmSync(path.join('uploads', relative), { force: true });
      }
    } catch (storageErr) {
      logger.warn('ticket deleteAttachment storage delete failed >>>', storageErr?.message);
    }

    const updated = await ticketRepository.removeAttachment(id, attachmentId);
    return res.status(200).json(await enrichAttachments(companyId, updated?.attachments || []));
  } catch (err) {
    logger.error('ticket deleteAttachment error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
