import Appointment from '../models/appointment.model.js';

class AppointmentRepository {
  async create(data) {
    return await Appointment.create(data);
  }

  async findByPhone(phone) {
    return await Appointment.find({ phone }).sort({ scheduledDate: -1 });
  }

  async findByDateRange(startDate, endDate) {
    return await Appointment.find({
      scheduledDate: {
        $gte: startDate,
        $lte: endDate
      },
      status: 'scheduled'
    });
  }

  async update(id, data) {
    return await Appointment.findByIdAndUpdate(id, data, { new: true });
  }

  async cancel(id) {
    return await Appointment.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true }
    );
  }

  async findAvailableSlots(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await Appointment.find({
      scheduledDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: 'scheduled'
    });
  }
}

export default new AppointmentRepository();