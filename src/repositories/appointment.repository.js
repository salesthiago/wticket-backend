import Appointment from "../models/appointment.model.js";

class AppointmentRepository {
  async create(data) {
    try {
      const appointment = new Appointment(data);
      
      return await appointment.save();
    } catch (error) {
      throw new Error(`Erro ao reservar Horário: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await Appointment.findById(id);
    } catch (error) {
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
  }
  async findByNumber(_phone) {
    try {
      return await Appointment.findOne({ phone: _phone });
    } catch (error) {
      throw new Error(`Erro ao buscar reserva pelo numero do telefone : ${error.message}`);
    }
  }

  async findAll({ query, page, rowsPerPage }) {
    try {
      return await Appointment.find(query)
        .limit(rowsPerPage)
        .skip(rowsPerPage * page);
    } catch (error) {
      throw new Error(`Erro ao buscar reservas: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      return await Appointment.findOneAndUpdate(
        { _id: id },
        { $set: { ...data } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar reserva: ${error.message}`);
    }
  }
}

export default new AppointmentRepository();
