import TicketCategory from '../models/ticket-category.model.js';

class TicketCategoryRepository {
  async findAll(onlyActive = false, companyId = null) {
    const query = { companyId: companyId ?? null };
    if (onlyActive) query.isActive = true;
    return TicketCategory.find(query).sort({ name: 1 });
  }

  async findById(id, companyId = null) {
    return TicketCategory.findOne({ _id: id, companyId: companyId ?? null });
  }

  async create(data) {
    return TicketCategory.create(data);
  }

  async update(id, data, companyId = null) {
    return TicketCategory.findOneAndUpdate(
      { _id: id, companyId: companyId ?? null },
      { $set: data },
      { new: true }
    );
  }

  async delete(id, companyId = null) {
    return TicketCategory.findOneAndDelete({ _id: id, companyId: companyId ?? null });
  }
}

export default new TicketCategoryRepository();
