import TicketStatus from '../models/ticket-status.model.js';

class TicketStatusRepository {
  async findAll(onlyActive = false, companyId = null) {
    const query = { companyId: companyId ?? null };
    if (onlyActive) query.isActive = true;
    return TicketStatus.find(query).sort({ order: 1, name: 1 });
  }

  async findById(id, companyId = null) {
    return TicketStatus.findOne({ _id: id, companyId: companyId ?? null });
  }

  async findDefault(companyId = null) {
    return TicketStatus.findOne({ isDefault: true, isActive: true, companyId: companyId ?? null });
  }

  async create(data) {
    return TicketStatus.create(data);
  }

  async update(id, data, companyId = null) {
    return TicketStatus.findOneAndUpdate(
      { _id: id, companyId: companyId ?? null },
      { $set: data },
      { new: true }
    );
  }

  async setDefault(id, companyId = null) {
    await TicketStatus.updateMany(
      { companyId: companyId ?? null },
      { $set: { isDefault: false } }
    );
    return TicketStatus.findByIdAndUpdate(id, { $set: { isDefault: true } }, { new: true });
  }

  async delete(id, companyId = null) {
    return TicketStatus.findOneAndDelete({ _id: id, companyId: companyId ?? null });
  }
}

export default new TicketStatusRepository();
