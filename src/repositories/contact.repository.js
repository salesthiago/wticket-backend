import Contact from "../models/contact.model.js";

class ContactRepository {
  // companyId is optional here because whatsapp ingestion services still
  // create contacts without a tenant context (TODO: tenant-aware services).
  async create(contactData) {
    try {
      const contact = new Contact(contactData);
      return await contact.save();
    } catch (error) {
      throw new Error(`Erro ao criar contato: ${error.message}`);
    }
  }

  async findById(id, { companyId } = {}) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      return await Contact.findOne(query);
    } catch (error) {
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
  }

  async findByNumber(_phone, { companyId } = {}) {
    try {
      const query = { phone: _phone };
      if (companyId) query.companyId = companyId;
      return await Contact.findOne(query);
    } catch (error) {
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
  }

  async updateOrCreate(number, data) {
    try {
      const filter = { sessionName: data.sessionName, phone: number };
      if (data.companyId) filter.companyId = data.companyId;
      return await Contact.findOneAndUpdate(
        filter,
        { $set: { ...data } },
        { new: true, upsert: true }
      );
    } catch (error) {
      throw error;
    }
  }

  async findAll({ query = {}, page = 0, rowsPerPage = 10, companyId } = {}) {
    try {
      const finalQuery = { ...query };
      if (companyId) finalQuery.companyId = companyId;
      return await Contact.find(finalQuery)
        .limit(rowsPerPage)
        .skip(rowsPerPage * page);
    } catch (error) {
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
  }

  async update(id, data, { companyId } = {}) {
    try {
      const filter = { _id: id };
      if (companyId) filter.companyId = companyId;
      const patch = { ...data };
      delete patch.companyId;
      return await Contact.findOneAndUpdate(
        filter,
        { $set: patch },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar contato: ${error.message}`);
    }
  }

  async destroy(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await Contact.findOneAndDelete({ _id: id, companyId });
  }
}

export default new ContactRepository();
