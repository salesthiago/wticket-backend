import dotenv from 'dotenv';
import mongoose from 'mongoose';
import BotConfig from '../models/bot-config.model.js';
import AutoResponse from '../models/auto-response.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wticket';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado ao MongoDB com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

async function seedTorreOracaoBot() {
  console.log('\n🙏 Criando Bot Torre de Oração...\n');

  try {
    // Remove bot existente com mesmo nome
    await BotConfig.deleteOne({ name: 'Bot Torre de Oração' });

    // Cria o Bot Config
    const botConfig = await BotConfig.create({
      name: 'Bot Torre de Oração',
      description: 'Bot para agendamento de horários na Torre de Oração',
      type: 'appointment',
      enabled: true,
      welcomeMessage: '🙏 *Torre de Oração*\n\nQue maravilha que você deseja reservar um momento especial de oração!\n\nVamos agendar seu horário.',
      defaultResponse: 'Desculpe, não entendi. Digite "ajuda" para ver as opções disponíveis.',
      confirmationMessage: '✅ *Horário reservado com sucesso!*\n\nVocê receberá um lembrete antes do horário.\n\nQue Deus abençoe seu momento de oração! 🙏',
      cancelMessage: '❌ Reserva cancelada.\n\nSe precisar, estamos aqui! Até logo! 👋',
      businessHours: {
        enabled: true,
        startTime: '06:00',
        endTime: '22:00',
        offHoursMessage: '🕐 A Torre de Oração está aberta das 6h às 22h.\n\nRetorne neste horário para fazer sua reserva.\n\nQue Deus te abençoe! 🙏',
        workingDays: [0, 1, 2, 3, 4, 5, 6] // Todos os dias
      },
      appointmentSettings: {
        defaultDuration: 30,
        slotInterval: 30,
        minAdvanceHours: 1,
        maxAdvanceDays: 15,
        availableSlots: [
          '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
          '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
          '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
          '20:00', '20:30', '21:00', '21:30'
        ]
      },
      commands: {
        cancel: ['cancelar', 'sair', 'parar', 'desistir'],
        restart: ['reiniciar', 'recomeçar', 'voltar'],
        help: ['ajuda', 'help', '?', 'menu']
      }
    });

    console.log(`✅ Bot criado: ${botConfig.name}`);

    // Cria as Auto Responses (fluxo conversacional)
    const autoResponses = [];

    // Passo 1: Data do agendamento
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 1,
      enabled: true,
      question: '📅 *Para qual data você gostaria de reservar?*\n\nUse o formato: DD/MM/AAAA\n_Exemplo: 20/12/2024_',
      answer: 'Data registrada! Agora vamos escolher o horário. 🙏',
      action: 'scheduledDate',
      triggerType: 'date',
      options: [],
      validations: [
        {
          type: 'futureDate',
          value: true,
          errorMessage: '⚠️ A data deve ser futura. Por favor, escolha uma data a partir de hoje.'
        }
      ],
      helpMessage: 'Digite a data no formato DD/MM/AAAA (exemplo: 15/01/2025)'
    }));

    // Passo 2: Horário do agendamento
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 2,
      enabled: true,
      question: '🕐 *Escolha um dos horários disponíveis:*\n\n' +
        '🌅 *Manhã:* 06:00 às 12:00\n' +
        '🌞 *Tarde:* 14:00 às 18:00\n' +
        '🌙 *Noite:* 18:00 às 22:00\n\n' +
        '*Digite o horário desejado*\n_Exemplo: 14:30_\n\n' +
        '💡 Cada horário tem duração de 30 minutos',
      answer: 'Horário selecionado! Quase lá... 🙏',
      action: 'scheduledTime',
      triggerType: 'time',
      options: [],
      validations: [
        {
          type: 'regex',
          value: '^(0[6-9]|1[01]):[0-3]0$|^(1[4-7]|2[01]):[0-3]0$',
          errorMessage: '⚠️ Horário inválido. Escolha entre 06:00-11:30 ou 14:00-21:30'
        }
      ],
      helpMessage: 'Digite o horário no formato HH:mm (exemplo: 14:30)'
    }));

    // Passo 3: Motivo/Intenção da oração
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 3,
      enabled: true,
      question: '📝 *Por favor, compartilhe brevemente sua intenção de oração:*\n\n_Isso nos ajuda a orar junto com você_',
      answer: 'Perfeito! Estou finalizando sua reserva... 🙏',
      action: 'description',
      triggerType: 'text',
      options: [],
      validations: [
        {
          type: 'minLength',
          value: 5,
          errorMessage: '⚠️ Por favor, compartilhe um pouco mais sobre sua intenção (mínimo 5 caracteres).'
        },
        {
          type: 'maxLength',
          value: 300,
          errorMessage: '⚠️ Texto muito longo. Use no máximo 300 caracteres.'
        }
      ],
      helpMessage: 'Descreva brevemente sua intenção de oração'
    }));

    console.log(`✅ ${autoResponses.length} perguntas criadas!\n`);

    // Exibe resumo
    console.log('═'.repeat(60));
    console.log('\n📊 RESUMO DO BOT CRIADO:\n');
    console.log(`Nome: ${botConfig.name}`);
    console.log(`Tipo: ${botConfig.type}`);
    console.log(`Status: ${botConfig.enabled ? 'Ativo ✅' : 'Inativo ❌'}`);
    console.log(`\nHorário de Funcionamento:`);
    console.log(`  ${botConfig.businessHours.startTime} às ${botConfig.businessHours.endTime}`);
    console.log(`  Dias: Todos os dias da semana`);
    console.log(`\nFluxo Conversacional (${autoResponses.length} etapas):`);

    autoResponses.forEach((ar, index) => {
      console.log(`  ${index + 1}. ${ar.action} (${ar.triggerType})`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ Bot Torre de Oração criado com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar bot:', error);
    throw error;
  }
}

// Executa o seed
async function run() {
  try {
    await connectDB();
    await seedTorreOracaoBot();
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB fechada.');
    process.exit(0);
  }
}

run();
