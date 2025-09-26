import Contact from "../models/contact.model.js";

class ContactRepository {
  async create(sessionData) {
    try {
      const contact = new Contact(sessionData);
      contact.name = name;
      if (email) {
        contact.email = email;
      }
      contact.phone = onlyNumbers(phone);
      contact.status = status;
      if (avatar) {
        contact.avatar = avatar;
      }

      return await contact.save();
    } catch (error) {
      throw new Error(`Erro ao criar contato: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await Contact.findById(id);
    } catch (error) {
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
  }
  async findByNumber(_phone) {
    try {
      return await Contact.findOne({ phone: _phone });
    } catch (error) {
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
  }

  async updateOrCreate(phone, data) {
    try {
      return await Contact.findOneAndUpdate(
        { phone },
        { $set: { ...data } },
        { new: true, upsert: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar/criar sessão: ${error.message}`);
    }
  }

  async findAll({ query, page, rowsPerPage }) {
    try {
      return await Contact.find(query)
        .limit(rowsPerPage)
        .skip(rowsPerPage * page);
    } catch (error) {
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      return await Contact.findOneAndUpdate(
        { _id: id },
        { $set: { ...data } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar contato: ${error.message}`);
    }
  }
}

export default new ContactRepository();
