import User from "../models/user.model.js";
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

class UserRepository {
  async create({ name, email, role, password, status }) {
    try {
      const userCreated = new User();
      userCreated.name = name;
      userCreated.email = email;
      userCreated.role = role;
      userCreated.status = status;
      userCreated.password = password;

      return await userCreated.save();
    } catch (error) {
      throw new Error("Erro ao criar usuario: " + error.message);
    }
  }

  async findById(id) {
    try {
      return await User.findById(id);
    } catch (error) {
      throw new Error('Erro ao buscar usuario: ' + error.message);
    }
  }

  async findAll({ query, page, rowsPerPage }) {
    try {
      return await User.find(query)
        .limit(rowsPerPage)
        .skip(rowsPerPage * page);
    } catch (error) {
      throw new Error('Erro ao buscar usuario: '+ error.message);
    }
  }

  async update(id, data) {
    try {
      // Se a senha foi fornecida, faz o hash antes de atualizar
      if (data.password) {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        data.password = await bcrypt.hash(data.password, salt);
      }

      return await User.findOneAndUpdate(
        { _id: id },
        { $set: { ...data } },
        { new: true }
      );
    } catch (error) {
      throw new Error('Erro ao atualizar Usuário: '+ error.message);
    }
  }
  async destroy(id) {
    try {
      return await User.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Erro ao deletar Usuário: '+ error.message);
    }
  }
}

export default new UserRepository();
