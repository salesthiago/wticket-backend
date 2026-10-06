import TicketSubject from '../models/ticket-subject.model.js';

class TicketSubjectRepository {
  async findAll(categoryId = null, onlyActive = false, companyId = null) {
    const query = { companyId: companyId ?? null };
    if (categoryId) query.categoryId = categoryId;
    if (onlyActive) query.isActive = true;
    return TicketSubject.find(query).populate('categoryId', 'name color').sort({ name: 1 });
  }

  async findById(id, companyId = null) {
    return TicketSubject.findOne({ _id: id, companyId: companyId ?? null })
      .populate('categoryId', 'name color');
  }

  async create(data) {
    return TicketSubject.create(data);
  }

  async update(id, data, companyId = null) {
    return TicketSubject.findOneAndUpdate(
      { _id: id, companyId: companyId ?? null },
      { $set: data },
      { new: true }
    );
  }

  async delete(id, companyId = null) {
    return TicketSubject.findOneAndDelete({ _id: id, companyId: companyId ?? null });
  }
}

export default new TicketSubjectRepository();
