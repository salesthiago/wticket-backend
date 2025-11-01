
import Appointment from '../models/appointment.model';
//import ReminderService from './re';

class AppointmentService {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
    this.reminderService = new ReminderService(whatsappService);
  }

  async create(appointmentData) {
    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    // Confirmar agendamento via WhatsApp
    await this.sendConfirmation(appointment);
    
    return appointment;
  }

  async sendConfirmation(appointment) {
    const formattedDate = new Date(appointment.scheduledDate).toLocaleString('pt-BR');
    
    const message = `✅ *Agendamento Confirmado!*
    
📅 *Data/Hora:* ${formattedDate}
📝 *Assunto:* ${appointment.description}

Você receberá um lembrete 1 hora antes do atendimento.`;

    await this.whatsappService.sendText(appointment.phone, message);
  }

  async getUpcomingAppointments(companyId) {
    return await Appointment.find({
      companyId,
      scheduledDate: { 
        $gte: new Date(),
        $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Próximas 24h
      },
      status: 'scheduled'
    }).sort({ scheduledDate: 1 });
  }
}

module.exports = AppointmentService;