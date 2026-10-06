import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import projectRepository from '../repositories/project.repository.js';
import projectStatusRepository from '../repositories/project-status.repository.js';
import ticketRepository from '../repositories/ticket.repository.js';
import { buildProjectsWorkbook } from '../services/project-excel.service.js';
import * as s3Service from '../services/storage/s3.service.js';
import receivableService from '../services/financial/receivable.service.js';

// Exclusão de projeto: liberada para quem criou o registro ou para
// administradores (mesma regra usada para tickets/respostas).
const ADMIN_ROLES = ['administrator', 'company_admin', 'super_admin'];
function canDelete(ownerId, req) {
  if (ADMIN_ROLES.includes(req.user?.role)) return true;
  if (!ownerId) return false;
  const userId = req.user?.sub;
  return userId && ownerId.toString() === userId.toString();
}

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { statusId, priority, customerId } = req.query;
    // Login de cliente: ignora qualquer customerId vindo da query e força o próprio.
    const effectiveCustomerId = scopeCustomerId || customerId;
    const projects = await projectRepository.findAll({ companyId, statusId, priority, customerId: effectiveCustomerId });
    return res.status(200).json(projects);
  } catch (err) {
    logger.error('project findAll error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { title, description, startDate, endDate, priority, statusId, hourlyRate } = req.body;
    let { customerId } = req.body;

    // Login de cliente só cria projeto amarrado a si mesmo.
    if (scopeCustomerId) {
      customerId = scopeCustomerId;
    }

    if (!title) return res.status(422).json({ message: 'Título é obrigatório' });

    let resolvedStatusId = statusId;
    if (!resolvedStatusId) {
      const defaultStatus = await projectStatusRepository.findDefault(companyId);
      if (defaultStatus) resolvedStatusId = defaultStatus._id;
    }

    const project = await projectRepository.create({
      companyId,
      title,
      description,
      startDate,
      endDate,
      priority,
      statusId: resolvedStatusId,
      customerId: customerId || null,
      hourlyRate,
      createdBy: req.user?.sub || null
    });

    return res.status(201).json(project);
  } catch (err) {
    logger.error('project create error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;
    const project = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado' });

    const stats = await projectRepository.getStats(id, companyId);
    const totalValue = stats.totalWorkedHours * (project.hourlyRate ?? 0);

    return res.status(200).json({
      ...project.toObject(),
      stats: { ...stats, totalValue }
    });
  } catch (err) {
    logger.error('project findById error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;
    if (!req.body) return res.status(422).json({ message: 'Body is empty' });

    // Escopo de cliente: só pode editar o(s) próprio(s) projeto(s) e não pode
    // reatribuir para outro cliente/empresa.
    const patch = { ...req.body };
    if (scopeCustomerId) {
      const existing = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
      if (!existing) return res.status(404).json({ message: 'Projeto não encontrado' });
      delete patch.customerId;
      delete patch.companyId;
    }

    const updated = await projectRepository.update(id, patch, { companyId });
    if (!updated) return res.status(404).json({ message: 'Projeto não encontrado' });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('project update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;

    const existing = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!existing) return res.status(404).json({ message: 'Projeto não encontrado' });

    const ownerId = existing.createdBy?._id || existing.createdBy;
    if (!canDelete(ownerId, req)) {
      return res.status(403).json({ message: 'Somente quem criou o projeto ou um administrador pode excluí-lo' });
    }

    const deleted = await projectRepository.deleteProject(id, { companyId });
    if (!deleted) return res.status(404).json({ message: 'Projeto não encontrado' });
    return res.status(200).json({ message: 'Projeto deletado com sucesso' });
  } catch (err) {
    logger.error('project destroy error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const exportExcel = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;

    const project = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado' });

    const tasks = await ticketRepository.findAll({ projectId: project._id, companyId });
    const tasksByProject = new Map([[String(project._id), tasks]]);

    const workbook = await buildProjectsWorkbook([project], tasksByProject);
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `${project.projectNumber || 'projeto'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    logger.error('project exportExcel error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findTickets = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;

    // Garante que o projeto pertence ao escopo do cliente antes de listar suas tarefas.
    const project = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado' });

    const tickets = await ticketRepository.findAll({ projectId: id, companyId });
    return res.status(200).json(tickets);
  } catch (err) {
    logger.error('project findTickets error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Documentos do Projeto ──────────────────────────────────────────────────

// Armazena o arquivo no S3 da empresa (quando configurado) ou no disco local
// — mesmo padrão usado para fotos de Ordem de Serviço.
const storeProjectDocument = async ({ companyId, projectId, file, req, uploadedBy }) => {
  const ts = Date.now();
  const rand = Math.round(Math.random() * 1e9);
  const ext = (file.originalname.match(/\.([A-Za-z0-9]+)$/)?.[1] || 'dat').toLowerCase();
  const objectName = `${ts}-${rand}.${ext}`;

  const useS3 = await s3Service.hasConfig(companyId);
  if (useS3) {
    const result = await s3Service.uploadObject({
      companyId,
      category: `projects/${projectId}/documents`,
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

  // Fallback local: grava em uploads/projects/<id>/documents e serve por /uploads.
  const dir = path.join('uploads', 'projects', String(projectId), 'documents');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, objectName), file.buffer);
  const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
  return {
    url: `${baseUrl}/uploads/projects/${projectId}/documents/${objectName}`,
    storageSource: 'local',
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    uploadedBy
  };
};

const DOCUMENT_VIEW_EXPIRES_IN = 15 * 60; // 15 min

// Resolve a URL de exibição/download: assinada (temporária) para objetos
// privados no S3 (company/default), ou a URL já persistida para arquivos locais.
const resolveDocumentViewUrl = async ({ companyId, document, expiresIn = DOCUMENT_VIEW_EXPIRES_IN }) => {
  if (document?.storageKey && (document.storageSource === 'company' || document.storageSource === 'default')) {
    return await s3Service.getPresignedUrl({ companyId, key: document.storageKey, expiresIn });
  }
  return document?.url || null;
};

const enrichDocuments = async (companyId, documents = []) => {
  return await Promise.all(
    documents.map(async (d) => {
      const obj = d.toObject ? d.toObject() : { ...d };
      try {
        obj.viewUrl = await resolveDocumentViewUrl({ companyId, document: obj });
      } catch (err) {
        logger.warn('project enrichDocuments sign failed >>>', err?.message);
        obj.viewUrl = obj.url || null;
      }
      return obj;
    })
  );
};

export const getDocuments = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;

    const project = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado' });

    const enriched = await enrichDocuments(companyId, project.documents || []);
    return res.status(200).json(enriched);
  } catch (err) {
    logger.error('project getDocuments error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Gera/renova sob demanda a URL temporária de um documento específico.
export const getDocumentUrl = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id, documentId } = req.params;

    const project = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado' });

    const document = project.documents.id(documentId);
    if (!document) return res.status(404).json({ message: 'Documento não encontrado' });

    const url = await resolveDocumentViewUrl({ companyId, document: document.toObject() });
    if (!url) return res.status(404).json({ message: 'URL do documento indisponível' });

    return res.status(200).json({ url, expiresIn: DOCUMENT_VIEW_EXPIRES_IN });
  } catch (err) {
    logger.error('project getDocumentUrl error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addDocument = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id } = req.params;

    if (!req.file) return res.status(422).json({ message: 'Arquivo é obrigatório' });

    const project = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado' });

    let document;
    try {
      document = await storeProjectDocument({
        companyId, projectId: id, file: req.file, req, uploadedBy: req.user?.sub || null
      });
    } catch (uploadErr) {
      logger.error('project addDocument upload error >>>', uploadErr);
      return res.status(500).json({ message: uploadErr?.message || 'Falha ao enviar documento' });
    }

    const updated = await projectRepository.addDocument(companyId, id, document);
    const enriched = await enrichDocuments(companyId, updated.documents || []);
    return res.status(201).json(enriched);
  } catch (err) {
    logger.error('project addDocument error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const scopeCustomerId = req.user?.customerId || null;
    const { id, documentId } = req.params;

    const project = await projectRepository.findById(id, { companyId, customerId: scopeCustomerId });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado' });

    const document = project.documents.id(documentId);
    if (!document) return res.status(404).json({ message: 'Documento não encontrado' });

    // Best-effort: remove do S3 quando aplicável (não bloqueia a remoção do registro).
    if (document.storageKey && (document.storageSource === 'company' || document.storageSource === 'default')) {
      try {
        await s3Service.deleteObject({ companyId, key: document.storageKey });
      } catch (s3Err) {
        logger.warn('project deleteDocument S3 delete failed >>>', s3Err?.message);
      }
    }

    const updated = await projectRepository.removeDocument(companyId, id, documentId);
    if (!updated) return res.status(404).json({ message: 'Projeto não encontrado' });

    const enriched = await enrichDocuments(companyId, updated.documents || []);
    return res.status(200).json(enriched);
  } catch (err) {
    logger.error('project deleteDocument error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Faturamento ──────────────────────────────────────────────────────────────

export const invoice = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.sub;
    const { id } = req.params;

    const role = req.user.role;
    if (!['super_admin', 'administrator', 'finance'].includes(role)) {
      return res.status(403).json({ message: 'Apenas usuários com role administrator ou finance podem faturar.' });
    }

    const modules = req.user.modules || [];
    if (!modules.includes('financial')) {
      return res.status(403).json({ message: 'Módulo financeiro não está ativo para esta empresa.' });
    }

    const doc = await receivableService.invoiceFromProject({
      companyId,
      userId,
      projectId: id,
      data: req.body || {}
    });
    return res.status(201).json(doc);
  } catch (err) {
    logger.error('ProjectController :: invoice >> ', err);
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
    const list = await receivableService.listByProject(companyId, id);
    return res.status(200).json(list);
  } catch (err) {
    logger.error('ProjectController :: listReceivables >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
