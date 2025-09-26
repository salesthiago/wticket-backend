import logger from "../utils/logger.js";
import { diacriticSensitiveRegex, onlyNumbers } from "../utils/formatter.js";
import ticketRepository from "../repositories/ticket.repository.js";

export const findAll = async (req, res) => {
  try {
    const { search, session } = req.query;
    const page = req?.page - 1 || 0;
    const rowsPerPage = req?.perPage || 10;

    const query = {};
    const tickets = await ticketRepository.findAll(session);

    return res.status(200).json(tickets);
  } catch (err) {
    logger.error("contact FindALL error >>> ", err);
    res.status(500).json({ message: "Internal server error" });
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
