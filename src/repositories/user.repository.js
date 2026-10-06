import User from "../models/user.model.js";
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

class UserRepository {
  async create({ name, email, role, password, status, companyId, customerId }) {
    try {
      const userCreated = new User();
      userCreated.name = name;
      userCreated.email = email;
      userCreated.role = role;
      userCreated.status = status;
      userCreated.password = password;
      if (companyId) userCreated.companyId = companyId;
      if (customerId) userCreated.customerId = customerId;

      return await userCreated.save();
    } catch (error) {
      throw new Error("Erro ao criar usuario: " + error.message);
    }
  }

  async findById(id, { companyId } = {}) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      return await User.findOne(query);
    } catch (error) {
      throw new Error('Erro ao buscar usuario: ' + error.message);
    }
  }

  async findAll({ query = {}, page = 0, rowsPerPage = 10, companyId } = {}) {
    try {
      const finalQuery = { ...query };
      if (companyId) finalQuery.companyId = companyId;
      return await User.find(finalQuery)
        .limit(rowsPerPage)
        .skip(rowsPerPage * page);
    } catch (error) {
      throw new Error('Erro ao buscar usuario: ' + error.message);
    }
  }

  async update(id, data, { companyId } = {}) {
    try {
      if (data.password) {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        data.password = await bcrypt.hash(data.password, salt);
      }

      const filter = { _id: id };
      if (companyId) filter.companyId = companyId;
      const patch = { ...data };
      delete patch.companyId;

      return await User.findOneAndUpdate(
        filter,
        { $set: patch },
        { new: true }
      );
    } catch (error) {
      throw new Error('Erro ao atualizar Usuário: ' + error.message);
    }
  }

  async destroy(id, { companyId } = {}) {
    try {
      const filter = { _id: id };
      if (companyId) filter.companyId = companyId;
      return await User.findOneAndDelete(filter);
    } catch (error) {
      throw new Error('Erro ao deletar Usuário: ' + error.message);
    }
  }
}

export default new UserRepository();
