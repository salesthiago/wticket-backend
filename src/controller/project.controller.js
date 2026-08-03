import logger from '../utils/logger.js';
import projectRepository from '../repositories/project.repository.js';
import projectStatusRepository from '../repositories/project-status.repository.js';
import ticketRepository from '../repositories/ticket.repository.js';
import { buildProjectsWorkbook } from '../services/project-excel.service.js';

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
