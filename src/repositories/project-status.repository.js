import ProjectStatus from '../models/project-status.model.js';

class ProjectStatusRepository {
  async findAll(onlyActive = false, companyId = null) {
    const query = { companyId: companyId ?? null };
    if (onlyActive) query.isActive = true;
    return ProjectStatus.find(query).sort({ order: 1, name: 1 });
  }

  async findById(id, companyId = null) {
    return ProjectStatus.findOne({ _id: id, companyId: companyId ?? null });
  }

  async findDefault(companyId = null) {
    return ProjectStatus.findOne({ isDefault: true, isActive: true, companyId: companyId ?? null });
  }

  async create(data) {
    return ProjectStatus.create(data);
  }

  async update(id, data, companyId = null) {
    return ProjectStatus.findOneAndUpdate(
      { _id: id, companyId: companyId ?? null },
      { $set: data },
      { new: true }
    );
  }

  async setDefault(id, companyId = null) {
    await ProjectStatus.updateMany(
      { companyId: companyId ?? null },
      { $set: { isDefault: false } }
    );
    return ProjectStatus.findByIdAndUpdate(id, { $set: { isDefault: true } }, { new: true });
  }

  async delete(id, companyId = null) {
    return ProjectStatus.findOneAndDelete({ _id: id, companyId: companyId ?? null });
  }
}

export default new ProjectStatusRepository();
