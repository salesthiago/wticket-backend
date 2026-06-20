import TicketCategory from '../models/ticket-category.model.js';

class TicketCategoryRepository {
  async findAll(onlyActive = false) {
    const query = onlyActive ? { isActive: true } : {};
    return TicketCategory.find(query).sort({ name: 1 });
  }

  async findById(id) {
    return TicketCategory.findById(id);
  }

  async create(data) {
    return TicketCategory.create(data);
  }

  async update(id, data) {
    return TicketCategory.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async delete(id) {
    return TicketCategory.findByIdAndDelete(id);
  }
}

export default new TicketCategoryRepository();
