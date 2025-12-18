import mongoose from 'mongoose';
import BotConfig from '../models/bot-config.model.js';
import AutoResponse from '../models/auto-response.model.js';

async function seedBotAgenda() {
  try {
    // Limpa dados anteriores
    await AutoResponse.deleteMany({ botConfig: { $exists: true } });
    await BotConfig.deleteOne({ name: 'Bot Agenda' });

    // Cria o Bot Config
    const botConfig = await BotConfig.create({
      name: 'Bot Agenda',
      enabled: true,
      welcomeMessage: '👋 Olá! Sou o assistente de agendamentos.\n\nVou te ajudar a agendar um horário. Vamos começar?',
      defaultResponse: 'Obrigado pelo contato. Um atendente entrará em contato em breve.',
      businessHours: {
        enabled: true,
        startTime: '09:00',
        endTime: '18:00',
        offHoursMessage: '🕐 No momento estamos fora do horário de atendimento.\n\nNosso horário de funcionamento é de segunda a sexta, das 9h às 18h.\n\nDeixe sua mensagem que retornaremos assim que possível!'
      }
    });

    // Cria as perguntas/respostas
    const autoResponses = [
      {
        botConfig: botConfig._id,
        triggerType: 'text',
        question: '📝 Por favor, descreva o motivo do seu agendamento:',
        answer: 'Ótimo! Recebi sua descrição.',
        action: 'description',
        enabled: true,
        priority: 1,
        options: []
      },
      {
        botConfig: botConfig._id,
        triggerType: 'date',
        question: '📅 Qual data você prefere? (formato: DD/MM/AAAA)',
        answer: 'Perfeito! Data registrada.',
        action: 'date',
        enabled: true,
        priority: 2,
        options: []
      }
    ];

    await AutoResponse.insertMany(autoResponses);

    console.log('✅ Bot Agenda criado com sucesso!');
    console.log(`ID do Bot: ${botConfig._id}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar Bot Agenda:', error);
  }
}

// Se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wticket')
    .then(() => seedBotAgenda())
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export default seedBotAgenda;