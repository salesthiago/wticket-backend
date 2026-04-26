import Appointment from '../models/appointment.model.js';

// companyId is optional here because bot-agenda service still creates
// appointments without tenant context. TODO: make services tenant-aware.
class AppointmentRepository {
  async create(data) {
    return await Appointment.create(data);
  }

  async findByPhone(phone, { companyId } = {}) {
    const query = { phone };
    if (companyId) query.companyId = companyId;
    return await Appointment.find(query).sort({ scheduledDate: -1 });
  }

  async findByDateRange(startDate, endDate, { companyId } = {}) {
    const query = {
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: 'scheduled'
    };
    if (companyId) query.companyId = companyId;
    return await Appointment.find(query);
  }

  async update(id, data, { companyId } = {}) {
    const filter = { _id: id };
    if (companyId) filter.companyId = companyId;
    const patch = { ...data };
    delete patch.companyId;
    return await Appointment.findOneAndUpdate(filter, patch, { new: true });
  }

  async cancel(id, { companyId } = {}) {
    const filter = { _id: id };
    if (companyId) filter.companyId = companyId;
    return await Appointment.findOneAndUpdate(
      filter,
      { status: 'cancelled' },
      { new: true }
    );
  }

  async findAvailableSlots(date, { companyId } = {}) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'scheduled'
    };
    if (companyId) query.companyId = companyId;
    return await Appointment.find(query);
  }
}

export default new AppointmentRepository();
