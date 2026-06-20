import TicketStatus from '../models/ticket-status.model.js';

class TicketStatusRepository {
  async findAll(onlyActive = false) {
    const query = onlyActive ? { isActive: true } : {};
    return TicketStatus.find(query).sort({ order: 1, name: 1 });
  }

  async findById(id) {
    return TicketStatus.findById(id);
  }

  async findDefault() {
    return TicketStatus.findOne({ isDefault: true, isActive: true });
  }

  async create(data) {
    return TicketStatus.create(data);
  }

  async update(id, data) {
    return TicketStatus.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async setDefault(id) {
    await TicketStatus.updateMany({}, { $set: { isDefault: false } });
    return TicketStatus.findByIdAndUpdate(id, { $set: { isDefault: true } }, { new: true });
  }

  async delete(id) {
    return TicketStatus.findByIdAndDelete(id);
  }
}

export default new TicketStatusRepository();
