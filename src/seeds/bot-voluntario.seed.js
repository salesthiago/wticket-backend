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

async function seedVoluntarioBot() {
  console.log('\n❤️ Criando Bot Voluntários...\n');

  try {
    // Remove bot existente com mesmo nome
    await BotConfig.deleteOne({ name: 'Bot Voluntários' });

    // Cria o Bot Config
    const botConfig = await BotConfig.create({
      name: 'Bot Voluntários',
      description: 'Bot para cadastro e gestão de voluntários da igreja',
      type: 'survey',
      enabled: true,
      welcomeMessage: '❤️ *Que benção ter você como voluntário(a)!*\n\nSeu desejo de servir é uma inspiração para todos nós.\n\nVamos completar seu cadastro para que possamos te incluir nas atividades.',
      defaultResponse: 'Desculpe, não entendi. Digite "ajuda" para ver as opções disponíveis.',
      confirmationMessage: '✅ *Cadastro concluído com sucesso!*\n\nEm breve entraremos em contato com mais informações sobre as atividades.\n\nQue Deus abençoe seu ministério! ❤️🙏',
      cancelMessage: '👋 Cadastro cancelado.\n\nQuando estiver pronto(a), é só retornar! Que Deus te abençoe!',
      businessHours: {
        enabled: false,
        startTime: '08:00',
        endTime: '20:00',
        offHoursMessage: '🕐 Estamos fora do horário de atendimento.\n\nRetornaremos em breve!',
        workingDays: [0, 1, 2, 3, 4, 5, 6]
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

    // Passo 1: Telefone de contato
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 1,
      enabled: true,
      question: '📱 *Qual é o melhor telefone para contato?*\n\n_Exemplo: (11) 98765-4321_',
      answer: 'Telefone registrado! 📱',
      action: 'phone',
      triggerType: 'phone',
      options: [],
      validations: [],
      helpMessage: 'Digite seu telefone com DDD'
    }));

    // Passo 2: E-mail
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 2,
      enabled: true,
      question: '📧 *Qual é o seu e-mail?*\n\n_Exemplo: seunome@email.com_',
      answer: 'E-mail registrado! 📧',
      action: 'email',
      triggerType: 'email',
      options: [],
      validations: [],
      helpMessage: 'Digite um e-mail válido'
    }));

    // Passo 3: Área de interesse
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 3,
      enabled: true,
      question: '🎯 *Em qual área você gostaria de servir?*\n\nEscolha uma das opções:\n\n' +
        '1️⃣ Louvor e Adoração\n' +
        '2️⃣ Ministério Infantil\n' +
        '3️⃣ Recepção\n' +
        '4️⃣ Mídia e Tecnologia\n' +
        '5️⃣ Intercessão\n' +
        '6️⃣ Ação Social\n' +
        '7️⃣ Outros\n\n' +
        'Digite o número ou nome da área:',
      answer: 'Que benção! Esta é uma área muito importante! ❤️',
      action: 'area',
      triggerType: 'option',
      options: [
        { value: 'louvor', text: '1️⃣ Louvor e Adoração', nextStep: null },
        { value: 'infantil', text: '2️⃣ Ministério Infantil', nextStep: null },
        { value: 'recepcao', text: '3️⃣ Recepção', nextStep: null },
        { value: 'midia', text: '4️⃣ Mídia e Tecnologia', nextStep: null },
        { value: 'intercessao', text: '5️⃣ Intercessão', nextStep: null },
        { value: 'social', text: '6️⃣ Ação Social', nextStep: null },
        { value: 'outros', text: '7️⃣ Outros', nextStep: null }
      ],
      validations: [],
      helpMessage: 'Digite o número (1 a 7) ou o nome da área desejada'
    }));

    // Passo 4: Dias disponíveis
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 4,
      enabled: true,
      question: '📅 *Quais dias da semana você tem disponibilidade?*\n\nEscolha uma das opções:\n\n' +
        '1️⃣ Aos domingos\n' +
        '2️⃣ Durante a semana\n' +
        '3️⃣ Finais de semana\n' +
        '4️⃣ Qualquer dia\n\n' +
        'Digite o número da opção:',
      answer: 'Perfeito! Anotado sua disponibilidade! 📅',
      action: 'availability',
      triggerType: 'option',
      options: [
        { value: 'domingos', text: '1️⃣ Aos domingos', nextStep: null },
        { value: 'semana', text: '2️⃣ Durante a semana', nextStep: null },
        { value: 'finais_semana', text: '3️⃣ Finais de semana', nextStep: null },
        { value: 'qualquer', text: '4️⃣ Qualquer dia', nextStep: null }
      ],
      validations: [],
      helpMessage: 'Digite o número (1 a 4) da sua disponibilidade'
    }));

    // Passo 5: Experiência prévia
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 5,
      enabled: true,
      question: '💼 *Você já teve alguma experiência anterior nesta área?*\n\nEscolha uma opção:\n\n' +
        '1️⃣ Sim, tenho experiência\n' +
        '2️⃣ Não, mas tenho interesse em aprender\n\n' +
        'Digite o número da opção:',
      answer: 'Que ótimo! 💪',
      action: 'experience',
      triggerType: 'option',
      options: [
        { value: 'sim', text: '1️⃣ Sim, tenho experiência', nextStep: null },
        { value: 'nao', text: '2️⃣ Não, mas tenho interesse em aprender', nextStep: null }
      ],
      validations: [],
      helpMessage: 'Digite 1 para Sim ou 2 para Não'
    }));

    // Passo 6: Observações adicionais
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 6,
      enabled: true,
      question: '💬 *Gostaria de compartilhar algo mais ou alguma observação?*\n\n_Escreva livremente ou digite "não" para pular_',
      answer: 'Maravilha! Estou finalizando seu cadastro... ✨',
      action: 'notes',
      triggerType: 'text',
      options: [],
      validations: [
        {
          type: 'maxLength',
          value: 500,
          errorMessage: '⚠️ Texto muito longo. Use no máximo 500 caracteres.'
        }
      ],
      skipCommand: 'não',
      helpMessage: 'Compartilhe suas observações ou digite "não" para pular'
    }));

    console.log(`✅ ${autoResponses.length} perguntas criadas!\n`);

    // Exibe resumo
    console.log('═'.repeat(60));
    console.log('\n📊 RESUMO DO BOT CRIADO:\n');
    console.log(`Nome: ${botConfig.name}`);
    console.log(`Tipo: ${botConfig.type}`);
    console.log(`Status: ${botConfig.enabled ? 'Ativo ✅' : 'Inativo ❌'}`);
    console.log(`\nFluxo Conversacional (${autoResponses.length} etapas):`);

    autoResponses.forEach((ar, index) => {
      console.log(`  ${index + 1}. ${ar.action} (${ar.triggerType})`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ Bot Voluntários criado com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar bot:', error);
    throw error;
  }
}

// Executa o seed
async function run() {
  try {
    await connectDB();
    await seedVoluntarioBot();
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
