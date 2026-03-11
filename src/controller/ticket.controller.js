import logger from "../utils/logger.js";
import { diacriticSensitiveRegex, onlyNumbers } from "../utils/formatter.js";
import ticketRepository from "../repositories/ticket.repository.js";

export const findAll = async (req, res) => {
  try {
    const { session, category } = req.query;
    const tickets = await ticketRepository.findAll(session, category);
    return res.status(200).json(tickets);
  } catch (err) {
    logger.error("contact FindALL error >>> ", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSaleItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { saleItems, category } = req.body;
    if (!id) return res.status(422).json({ message: 'ID not found' });

    const data = {};
    if (saleItems !== undefined) data.saleItems = saleItems;
    if (category !== undefined) data.category = category;

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
    if (!id) {
      return res.status(422).json({ message: "ID not founded" }, req);
    }
    const ticket = await ticketRepository.findById(id);
    if (!ticket)
      return res.status(404).json({ message: "Ticket not founded!" });

    return res.status(200).json(ticket);
  } catch (err) {
    logger.error("Login error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id, status } = req.params;
    if (!id) {
      return res.status(422).json({ message: "ID not founded" }, req);
    }
    if (!status) {
      return res.status(422).json({ message: "status not founded" }, req);
    }
    
    await ticketRepository.updateStatus(id, status);
   
    return res.status(201).json({ message: 'ticket deleted by successfully '});
  } catch (err) {
    logger.error("destroy error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req
    if (!id) {
      return res.status(422).json({ message: "ID not founded" }, req);
    }
    if (!body) {
      return res.status(422).json({ message: "The body is empty" }, req);
    }

    const updated = await ticketRepository.update(id, body);
   
    return res.status(200).json(updated);
  } catch (err) {
    logger.error("destroy error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const destroy = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ message: "ID not founded" }, req);
    }
    const ticket = await ticketRepository.deleteTicket(id);
    if (!ticket)
      return res.status(404).json({ message: "Ticket not founded!" });
  
    return res.status(201).json({ message: 'ticket deleted by successfully '});
  } catch (err) {
    logger.error("destroy error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
