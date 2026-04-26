import Company from '../models/company.model.js';

class CompanyRepository {
  async create(data) {
    const created = new Company(data);
    return await created.save();
  }

  async findAll({ query = {}, page = 0, rowsPerPage = 20 } = {}) {
    return await Company.find(query)
      .sort({ createdAt: -1 })
      .limit(rowsPerPage)
      .skip(rowsPerPage * page)
      .populate('modules.moduleId', 'code name price');
  }

  async findById(id) {
    return await Company.findById(id).populate('modules.moduleId', 'code name price');
  }

  async findByEmail(email) {
    return await Company.findOne({ email });
  }

  async findByDocument(document) {
    if (!document) return null;
    return await Company.findOne({ document });
  }

  async update(id, data) {
    return await Company.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { new: true }
    ).populate('modules.moduleId', 'code name price');
  }

  async setStatus(id, status) {
    return await Company.findOneAndUpdate(
      { _id: id },
      { $set: { status } },
      { new: true }
    );
  }

  async addModule(id, companyModule) {
    return await Company.findOneAndUpdate(
      { _id: id },
      { $push: { modules: companyModule } },
      { new: true }
    );
  }

  async removeModule(id, code) {
    return await Company.findOneAndUpdate(
      { _id: id },
      { $pull: { modules: { code } } },
      { new: true }
    );
  }

  async setModuleSubscription(id, code, patch) {
    const set = {};
    Object.entries(patch).forEach(([k, v]) => { set[`modules.$.${k}`] = v; });
    return await Company.findOneAndUpdate(
      { _id: id, 'modules.code': code },
      { $set: set },
      { new: true }
    );
  }

  async destroy(id) {
    return await Company.findByIdAndDelete(id);
  }
}

export default new CompanyRepository();
