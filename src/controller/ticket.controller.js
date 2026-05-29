import logger from "../utils/logger.js";
import ticketRepository from "../repositories/ticket.repository.js";

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { session, category } = req.query;
    const tickets = await ticketRepository.findAll(session, category, { companyId });
    return res.status(200).json(tickets);
  } catch (err) {
    logger.error("ticket FindALL error >>> ", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const {
      contactNumber,
      contactName,
      sessionName,
      subject,
      priority,
      category,
      origin,
      notes
    } = req.body;

    if (!contactNumber) return res.status(422).json({ message: 'contactNumber is required' });
    if (!sessionName) return res.status(422).json({ message: 'sessionName is required' });

    const ticket = await ticketRepository.create({
      companyId,
      contactNumber,
      contactName,
      sessionName,
      subject: subject || 'Atendimento',
      priority: priority || 'medium',
      category: category || 'support',
      origin: origin || 'manual',
      notes,
      status: 'opened'
    });

    return res.status(201).json(ticket);
  } catch (err) {
    logger.error('ticket create error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateSaleItems = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { saleItems, category } = req.body;
    if (!id) return res.status(422).json({ message: 'ID not found' });

    const data = {};
    if (saleItems !== undefined) data.saleItems = saleItems;
    if (category !== undefined) data.category = category;

    const updated = await ticketRepository.update(id, data, { companyId });
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
    if (!id) return res.status(422).json({ message: "ID not founded" });

    const ticket = await ticketRepository.findById(id, { companyId });
    if (!ticket) return res.status(404).json({ message: "Ticket not founded!" });

    return res.status(200).json(ticket);
  } catch (err) {
    logger.error("ticket findById error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id, status } = req.params;
    if (!id) return res.status(422).json({ message: "ID not founded" });
    if (!status) return res.status(422).json({ message: "status not founded" });

    await ticketRepository.updateStatus(id, status, {}, { companyId });

    return res.status(201).json({ message: 'ticket updated successfully' });
  } catch (err) {
    logger.error("ticket updateStatus error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { body } = req;
    if (!id) return res.status(422).json({ message: "ID not founded" });
    if (!body) return res.status(422).json({ message: "The body is empty" });

    const updated = await ticketRepository.update(id, body, { companyId });

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
    if (!id) return res.status(422).json({ message: "ID not founded" });

    const ticket = await ticketRepository.deleteTicket(id, { companyId });
    if (!ticket) return res.status(404).json({ message: "Ticket not founded!" });

    return res.status(201).json({ message: 'ticket deleted successfully' });
  } catch (err) {
    logger.error("ticket destroy error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
