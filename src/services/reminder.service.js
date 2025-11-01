
import cron from 'node-cron';
import Appointment from '../models/appointment.model';

class ReminderService {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.startReminderJob();
    }

    startReminderJob() {
        // Executa a cada minuto para verificar agendamentos
        cron.schedule('* * * * *', async () => {
            await this.checkAppointments();
        });
    }

    async checkAppointments() {
        try {
            const appointments = await Appointment.getAppointmentsToRemind();
            
            for (const appointment of appointments) {
                await this.sendReminder(appointment);
                await Appointment.markReminderSent(appointment.id);
            }
        } catch (error) {
            console.error('Erro ao verificar agendamentos:', error);
        }
    }

    async sendReminder(appointment) {
        const message = `🔔 *Lembrete de Agendamento*
        
Olá! Este é um lembrete do seu agendamento:
📅 *Data/Hora:* ${new Date(appointment.scheduled_date).toLocaleString('pt-BR')}
📝 *Assunto:* ${appointment.description}

Estaremos à disposição para atendê-lo!`;

        await this.whatsappService.sendText(appointment.phone, message);
    }
}

module.exports = ReminderService;