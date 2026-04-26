
import logger from '../utils/logger.js';
import { diacriticSensitiveRegex } from '../utils/formatter.js';
import appointmentRepository from '../repositories/appointment.repository.js';
import Appointment from '../models/appointment.model.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, status, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) - 1 || 0;
    const rowsPerPage = parseInt(req.query.perPage) || 10;

    const query = { companyId };

    if (search) {
      query.$or = [
        { description: { $regex: diacriticSensitiveRegex(search), $options: "i" } },
        { service: { $regex: diacriticSensitiveRegex(search), $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    if (status) query.status = status;

    if (startDate && endDate) {
      query.scheduledDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const appointments = await Appointment
      .find(query)
      .populate('contactId', 'name email phone')
      .populate('assignedTo', 'name email')
      .sort({ scheduledDate: -1, scheduledTime: -1 })
      .skip(page * rowsPerPage)
      .limit(rowsPerPage);

    const total = await Appointment.countDocuments(query);

    return res.status(200).json({
      data: appointments,
      total,
      page: page + 1,
      perPage: rowsPerPage,
      totalPages: Math.ceil(total / rowsPerPage)
    });
  } catch (err) {
    logger.error('appointmentController FindAll error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not provided' });

    const appointment = await Appointment.findOne({ _id: id, companyId })
      .populate('contactId', 'name email phone')
      .populate('assignedTo', 'name email');

    if (!appointment) return res.status(404).json({ message: 'Appointment not found!' });

    return res.json(appointment);
  } catch (err) {
    logger.error('appointmentController findById error >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { contactId, phone, scheduledDate, scheduledTime, description, service, assignedTo, status } = req.body;

    if (!contactId || !phone || !scheduledDate || !scheduledTime || !description) {
      return res.status(400).json({
        message: 'contactId, phone, scheduledDate, scheduledTime and description are required'
      });
    }

    const appointmentData = {
      companyId,
      contactId,
      phone,
      scheduledDate,
      scheduledTime,
      description,
      service,
      assignedTo,
      status: status || 'scheduled'
    };

    const appointment = await appointmentRepository.create(appointmentData);

    const populated = await Appointment.findById(appointment._id)
      .populate('contactId', 'name email phone')
      .populate('assignedTo', 'name email');

    return res.status(201).json(populated);
  } catch (err) {
    logger.error('Error to create appointment >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not provided' });

    const appointment = await Appointment.findOne({ _id: id, companyId });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found!' });

    const updated = await appointmentRepository.update(id, req.body, { companyId });

    const populated = await Appointment.findById(updated._id)
      .populate('contactId', 'name email phone')
      .populate('assignedTo', 'name email');

    return res.json(populated);
  } catch (err) {
    logger.error('appointmentController Update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not provided' });

    const appointment = await Appointment.findOne({ _id: id, companyId });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found!' });

    await Appointment.findOneAndDelete({ _id: id, companyId });

    return res.status(200).json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    logger.error('appointmentController destroy error >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const cancel = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { cancelReason } = req.body;

    if (!id) return res.status(422).json({ message: 'ID not provided' });

    const appointment = await Appointment.findOne({ _id: id, companyId });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found!' });

    const updated = await appointmentRepository.update(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: cancelReason || 'No reason provided'
    }, { companyId });

    return res.json(updated);
  } catch (err) {
    logger.error('appointmentController cancel error >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
