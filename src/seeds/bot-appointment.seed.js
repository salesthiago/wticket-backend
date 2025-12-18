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

async function seedBotAppointment() {
  console.log('\n🤖 Criando Bot de Agendamento...\n');

  try {
    // Remove bot existente com mesmo nome
    await BotConfig.deleteOne({ name: 'Bot Agenda' });
    await AutoResponse.deleteMany({ botConfig: { $exists: false } });

    // Cria o Bot Config
    const botConfig = await BotConfig.create({
      name: 'Bot Agenda',
      description: 'Bot inteligente para agendamento de consultas e atendimentos',
      type: 'appointment',
      enabled: true,
      welcomeMessage: '👋 Olá! Sou o assistente virtual de agendamentos.\n\nVou te ajudar a agendar seu horário de forma rápida e fácil!',
      defaultResponse: 'Desculpe, não entendi. Digite "ajuda" para ver as opções ou aguarde que um atendente entrará em contato.',
      confirmationMessage: '✅ *Agendamento confirmado!*\n\nVocê receberá um lembrete 24h antes do horário agendado.\n\nObrigado pela preferência! 😊',
      cancelMessage: '❌ Agendamento cancelado.\n\nSe precisar de algo, estou aqui! Até logo! 👋',
      businessHours: {
        enabled: true,
        startTime: '08:00',
        endTime: '18:00',
        offHoursMessage: '🕐 Estamos fora do horário de atendimento.\n\nNosso horário: Segunda a Sexta, das 8h às 18h.\n\nRetornaremos em breve!',
        workingDays: [1, 2, 3, 4, 5] // Segunda a Sexta
      },
      appointmentSettings: {
        defaultDuration: 60,
        slotInterval: 30,
        minAdvanceHours: 2,
        maxAdvanceDays: 30,
        availableSlots: [
          '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
          '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
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

    // Passo 1: Escolher tipo de serviço
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 1,
      enabled: true,
      question: '🏥 Qual tipo de atendimento você deseja agendar?',
      answer: 'Ótimo! Vamos prosseguir com o atendimento.',
      action: 'service',
      triggerType: 'option',
      options: [
        { value: 'consulta', text: '1️⃣ Consulta Médica', nextStep: null },
        { value: 'exame', text: '2️⃣ Exame', nextStep: null },
        { value: 'retorno', text: '3️⃣ Retorno', nextStep: null },
        { value: 'outros', text: '4️⃣ Outros', nextStep: null }
      ],
      validations: [],
      helpMessage: 'Digite o número ou nome da opção desejada'
    }));

    // Passo 2: Data do agendamento
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 2,
      enabled: true,
      question: '📅 Para qual data você gostaria de agendar?\n\n*Use o formato: DD/MM/AAAA*\n_Exemplo: 20/12/2024_',
      answer: 'Data registrada! Agora vamos escolher o horário.',
      action: 'scheduledDate',
      triggerType: 'date',
      options: [],
      validations: [
        {
          type: 'futureDate',
          value: true,
          errorMessage: '⚠️ A data deve ser futura. Por favor, escolha uma data a partir de hoje.'
        },
        {
          type: 'businessDays',
          value: true,
          errorMessage: '⚠️ Atendemos apenas em dias úteis (segunda a sexta). Por favor, escolha outro dia.'
        }
      ],
      helpMessage: 'Digite a data no formato DD/MM/AAAA (exemplo: 15/01/2025)'
    }));

    // Passo 3: Horário do agendamento
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 3,
      enabled: true,
      question: '🕐 Escolha um dos horários disponíveis:\n\n' +
        '• 08:00 às 12:00 (Manhã)\n' +
        '• 14:00 às 18:00 (Tarde)\n\n' +
        '*Digite o horário desejado*\n_Exemplo: 14:30_',
      answer: 'Horário selecionado! Quase lá...',
      action: 'scheduledTime',
      triggerType: 'time',
      options: [],
      validations: [
        {
          type: 'regex',
          value: '^(0[8-9]|1[01]):[0-3]0$|^(1[4-7]):[0-3]0$',
          errorMessage: '⚠️ Horário inválido. Escolha um horário entre 08:00-11:30 ou 14:00-17:30'
        }
      ],
      helpMessage: 'Digite o horário no formato HH:mm (exemplo: 14:30)'
    }));

    // Passo 4: Descrição/Motivo
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 4,
      enabled: true,
      question: '📝 Por favor, descreva brevemente o motivo do atendimento:',
      answer: 'Perfeito! Estou finalizando seu agendamento...',
      action: 'description',
      triggerType: 'text',
      options: [],
      validations: [
        {
          type: 'minLength',
          value: 10,
          errorMessage: '⚠️ Por favor, forneça uma descrição com pelo menos 10 caracteres.'
        },
        {
          type: 'maxLength',
          value: 200,
          errorMessage: '⚠️ Descrição muito longa. Use no máximo 200 caracteres.'
        }
      ],
      helpMessage: 'Descreva o motivo do seu atendimento (mínimo 10 caracteres)'
    }));

    console.log(`✅ ${autoResponses.length} perguntas criadas!\n`);

    // Exibe resumo
    console.log('═'.repeat(60));
    console.log('\n📊 RESUMO DO BOT CRIADO:\n');
    console.log(`Nome: ${botConfig.name}`);
    console.log(`Tipo: ${botConfig.type}`);
    console.log(`Status: ${botConfig.enabled ? 'Ativo ✅' : 'Inativo ❌'}`);
    console.log(`\nHorário de Atendimento:`);
    console.log(`  ${botConfig.businessHours.startTime} às ${botConfig.businessHours.endTime}`);
    console.log(`  Dias: Segunda a Sexta`);
    console.log(`\nFluxo Conversacional (${autoResponses.length} etapas):`);

    autoResponses.forEach((ar, index) => {
      console.log(`  ${index + 1}. ${ar.action} (${ar.triggerType})`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ Bot de agendamento criado com sucesso!\n');
    console.log('💡 Dica: Acesse o painel admin para gerenciar o bot\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar bot:', error);
    throw error;
  }
}

// Executa o seed
async function run() {
  try {
    await connectDB();
    await seedBotAppointment();
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
