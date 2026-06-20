import logger from "../utils/logger.js";
import ticketRepository from "../repositories/ticket.repository.js";
import ticketStatusRepository from "../repositories/ticket-status.repository.js";

export const findAll = async (req, res) => {
  try {
    const { categoryId, statusId, assignedTo } = req.query;
    const tickets = await ticketRepository.findAll({ categoryId, statusId, assignedTo });
    return res.status(200).json(tickets);
  } catch (err) {
    logger.error("ticket findAll error >>> ", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const create = async (req, res) => {
  try {
    const { contactNumber, contactName, categoryId, subjectId, statusId, priority, assignedTo, notes, tags } = req.body;

    let resolvedStatusId = statusId;
    if (!resolvedStatusId) {
      const defaultStatus = await ticketStatusRepository.findDefault();
      if (defaultStatus) resolvedStatusId = defaultStatus._id;
    }

    const ticket = await ticketRepository.create({
      contactNumber,
      contactName,
      categoryId,
      subjectId,
      statusId: resolvedStatusId,
      priority,
      assignedTo,
      notes,
      tags
    });

    return res.status(201).json(ticket);
  } catch (err) {
    logger.error("ticket create error >>> ", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSaleItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { saleItems, categoryId } = req.body;
    if (!id) return res.status(422).json({ message: 'ID not found' });

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
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: "ID not found" });
    const ticket = await ticketRepository.findById(id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.status(200).json(ticket);
  } catch (err) {
    logger.error("ticket findById error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statusId } = req.body;
    if (!id) return res.status(422).json({ message: "ID not found" });
    if (!statusId) return res.status(422).json({ message: "statusId not found" });
    const updated = await ticketRepository.updateStatus(id, statusId);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket updateStatus error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!id) return res.status(422).json({ message: "ID not found" });
    if (!content) return res.status(422).json({ message: "Conteúdo da resposta é obrigatório" });

    const respondedBy = req.user?.sub || req.user?._id;
    const updated = await ticketRepository.addResponse(id, { content, respondedBy });
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket addResponse error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: "ID not found" });
    if (!req.body) return res.status(422).json({ message: "Body is empty" });
    const updated = await ticketRepository.update(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("ticket update error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const destroy = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: "ID not found" });
    const ticket = await ticketRepository.deleteTicket(id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.status(200).json({ message: 'Ticket deletado com sucesso' });
  } catch (err) {
    logger.error("ticket destroy error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
