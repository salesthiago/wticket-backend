import TicketSubject from '../models/ticket-subject.model.js';

class TicketSubjectRepository {
  async findAll(categoryId = null, onlyActive = false) {
    const query = {};
    if (categoryId) query.categoryId = categoryId;
    if (onlyActive) query.isActive = true;
    return TicketSubject.find(query).populate('categoryId', 'name color').sort({ name: 1 });
  }

  async findById(id) {
    return TicketSubject.findById(id).populate('categoryId', 'name color');
  }

  async create(data) {
    return TicketSubject.create(data);
  }

  async update(id, data) {
    return TicketSubject.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async delete(id) {
    return TicketSubject.findByIdAndDelete(id);
  }
}

export default new TicketSubjectRepository();
