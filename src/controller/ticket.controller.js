import logger from "../utils/logger.js";
import ticketRepository from "../repositories/ticket.repository.js";
import ticketStatusRepository from "../repositories/ticket-status.repository.js";
import customerRepository from "../repositories/customer.repository.js";
import projectRepository from "../repositories/project.repository.js";

// Acesso de cliente ("portal"): quando o usuário logado tem customerId
// vinculado, ele só pode ver/mexer em tickets ligados diretamente a esse
// cliente ou aos projetos desse cliente.
function ticketBelongsToScope(ticket, scopeCustomerId) {
  if (!scopeCustomerId) return true;
  const ticketCustomerId = (ticket.customerId?._id || ticket.customerId)?.toString();
  const projectCustomerId = ticket.projectId?.customerId?.toString();
  return ticketCustomerId === scopeCustomerId || projectCustomerId === scopeCustomerId;
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
      endDate
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

    const ticket = await ticketRepository.deleteTicket(id, { companyId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.status(200).json({ message: 'Ticket deletado com sucesso' });
  } catch (err) {
    logger.error("ticket destroy error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
