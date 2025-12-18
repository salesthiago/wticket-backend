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

async function seedAllChurchBots() {
  console.log('\n🙏 ════════════════════════════════════════════════════════');
  console.log('   CRIANDO TODOS OS BOTS DA IGREJA');
  console.log('════════════════════════════════════════════════════════\n');

  try {
    // ========================================
    // BOT 1: Igreja Principal (Recepção)
    // ========================================
    console.log('📱 [1/3] Criando Bot Principal da Igreja...\n');

    await BotConfig.deleteOne({ name: 'Bot Igreja Principal' });

    const botMain = await BotConfig.create({
      name: 'Bot Igreja Principal',
      description: 'Bot de recepção principal da igreja - direciona para serviços específicos',
      type: 'custom',
      enabled: true,
      welcomeMessage: '🙏 *Paz e bem!*\n\nSeja muito bem-vindo(a) à nossa comunidade!\n\nPara melhor atendê-lo(a), preciso conhecê-lo(a) melhor.',
      defaultResponse: 'Desculpe, não entendi. Digite "ajuda" para ver as opções disponíveis.',
      confirmationMessage: '✅ Obrigado! Em breve você receberá mais informações.',
      cancelMessage: '👋 Até logo! Que Deus te abençoe!',
      businessHours: {
        enabled: false,
        startTime: '08:00',
        endTime: '20:00',
        offHoursMessage: '🕐 No momento estamos fora do horário de atendimento.\n\nRetornaremos em breve!\n\nQue Deus te abençoe! 🙏',
        workingDays: [0, 1, 2, 3, 4, 5, 6]
      },
      commands: {
        cancel: ['cancelar', 'sair', 'parar'],
        restart: ['reiniciar', 'recomeçar', 'voltar'],
        help: ['ajuda', 'help', '?', 'menu']
      }
    });

    await AutoResponse.create([
      {
        botConfig: botMain._id,
        priority: 1,
        enabled: true,
        question: '📝 *Qual é o seu nome?*\n\nPor favor, digite seu nome completo:',
        answer: 'Prazer em conhecê-lo(a), {name}! 😊',
        action: 'name',
        triggerType: 'text',
        options: [],
        validations: [
          { type: 'minLength', value: 3, errorMessage: '⚠️ Por favor, digite seu nome completo (mínimo 3 caracteres).' },
          { type: 'maxLength', value: 100, errorMessage: '⚠️ Nome muito longo. Use no máximo 100 caracteres.' }
        ],
        helpMessage: 'Digite seu nome completo para continuar'
      },
      {
        botConfig: botMain._id,
        priority: 2,
        enabled: true,
        question: '🙏 *Como podemos ajudá-lo(a) hoje?*\n\nEscolha uma das opções abaixo:\n\n1️⃣ Reservar horário na Torre de Oração\n2️⃣ Quero ser voluntário(a)\n\nDigite o número ou nome da opção desejada:',
        answer: 'Ótimo! Vou te direcionar para o atendimento adequado.',
        action: 'serviceType',
        triggerType: 'option',
        options: [
          { value: 'torre_oracao', text: '1️⃣ Reservar horário na Torre de Oração', nextStep: null },
          { value: 'voluntario', text: '2️⃣ Quero ser voluntário(a)', nextStep: null }
        ],
        validations: [],
        helpMessage: 'Digite o número (1 ou 2) ou o nome do serviço desejado'
      }
    ]);

    console.log(`   ✅ ${botMain.name} criado com sucesso!\n`);

    // ========================================
    // BOT 2: Torre de Oração
    // ========================================
    console.log('🙏 [2/3] Criando Bot Torre de Oração...\n');

    await BotConfig.deleteOne({ name: 'Bot Torre de Oração' });

    const botTorre = await BotConfig.create({
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
        workingDays: [0, 1, 2, 3, 4, 5, 6]
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

    await AutoResponse.create([
      {
        botConfig: botTorre._id,
        priority: 1,
        enabled: true,
        question: '📅 *Para qual data você gostaria de reservar?*\n\nUse o formato: DD/MM/AAAA\n_Exemplo: 20/12/2024_',
        answer: 'Data registrada! Agora vamos escolher o horário. 🙏',
        action: 'scheduledDate',
        triggerType: 'date',
        options: [],
        validations: [
          { type: 'futureDate', value: true, errorMessage: '⚠️ A data deve ser futura. Por favor, escolha uma data a partir de hoje.' }
        ],
        helpMessage: 'Digite a data no formato DD/MM/AAAA (exemplo: 15/01/2025)'
      },
      {
        botConfig: botTorre._id,
        priority: 2,
        enabled: true,
        question: '🕐 *Escolha um dos horários disponíveis:*\n\n🌅 *Manhã:* 06:00 às 12:00\n🌞 *Tarde:* 14:00 às 18:00\n🌙 *Noite:* 18:00 às 22:00\n\n*Digite o horário desejado*\n_Exemplo: 14:30_\n\n💡 Cada horário tem duração de 30 minutos',
        answer: 'Horário selecionado! Quase lá... 🙏',
        action: 'scheduledTime',
        triggerType: 'time',
        options: [],
        validations: [
          { type: 'regex', value: '^(0[6-9]|1[01]):[0-3]0$|^(1[4-7]|2[01]):[0-3]0$', errorMessage: '⚠️ Horário inválido. Escolha entre 06:00-11:30 ou 14:00-21:30' }
        ],
        helpMessage: 'Digite o horário no formato HH:mm (exemplo: 14:30)'
      },
      {
        botConfig: botTorre._id,
        priority: 3,
        enabled: true,
        question: '📝 *Por favor, compartilhe brevemente sua intenção de oração:*\n\n_Isso nos ajuda a orar junto com você_',
        answer: 'Perfeito! Estou finalizando sua reserva... 🙏',
        action: 'description',
        triggerType: 'text',
        options: [],
        validations: [
          { type: 'minLength', value: 5, errorMessage: '⚠️ Por favor, compartilhe um pouco mais sobre sua intenção (mínimo 5 caracteres).' },
          { type: 'maxLength', value: 300, errorMessage: '⚠️ Texto muito longo. Use no máximo 300 caracteres.' }
        ],
        helpMessage: 'Descreva brevemente sua intenção de oração'
      }
    ]);

    console.log(`   ✅ ${botTorre.name} criado com sucesso!\n`);

    // ========================================
    // BOT 3: Voluntários
    // ========================================
    console.log('❤️ [3/3] Criando Bot Voluntários...\n');

    await BotConfig.deleteOne({ name: 'Bot Voluntários' });

    const botVoluntario = await BotConfig.create({
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

    await AutoResponse.create([
      {
        botConfig: botVoluntario._id,
        priority: 1,
        enabled: true,
        question: '📱 *Qual é o melhor telefone para contato?*\n\n_Exemplo: (11) 98765-4321_',
        answer: 'Telefone registrado! 📱',
        action: 'phone',
        triggerType: 'phone',
        options: [],
        validations: [],
        helpMessage: 'Digite seu telefone com DDD'
      },
      {
        botConfig: botVoluntario._id,
        priority: 2,
        enabled: true,
        question: '📧 *Qual é o seu e-mail?*\n\n_Exemplo: seunome@email.com_',
        answer: 'E-mail registrado! 📧',
        action: 'email',
        triggerType: 'email',
        options: [],
        validations: [],
        helpMessage: 'Digite um e-mail válido'
      },
      {
        botConfig: botVoluntario._id,
        priority: 3,
        enabled: true,
        question: '🎯 *Em qual área você gostaria de servir?*\n\nEscolha uma das opções:\n\n1️⃣ Louvor e Adoração\n2️⃣ Ministério Infantil\n3️⃣ Recepção\n4️⃣ Mídia e Tecnologia\n5️⃣ Intercessão\n6️⃣ Ação Social\n7️⃣ Outros\n\nDigite o número ou nome da área:',
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
      },
      {
        botConfig: botVoluntario._id,
        priority: 4,
        enabled: true,
        question: '📅 *Quais dias da semana você tem disponibilidade?*\n\nEscolha uma das opções:\n\n1️⃣ Aos domingos\n2️⃣ Durante a semana\n3️⃣ Finais de semana\n4️⃣ Qualquer dia\n\nDigite o número da opção:',
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
      },
      {
        botConfig: botVoluntario._id,
        priority: 5,
        enabled: true,
        question: '💼 *Você já teve alguma experiência anterior nesta área?*\n\nEscolha uma opção:\n\n1️⃣ Sim, tenho experiência\n2️⃣ Não, mas tenho interesse em aprender\n\nDigite o número da opção:',
        answer: 'Que ótimo! 💪',
        action: 'experience',
        triggerType: 'option',
        options: [
          { value: 'sim', text: '1️⃣ Sim, tenho experiência', nextStep: null },
          { value: 'nao', text: '2️⃣ Não, mas tenho interesse em aprender', nextStep: null }
        ],
        validations: [],
        helpMessage: 'Digite 1 para Sim ou 2 para Não'
      },
      {
        botConfig: botVoluntario._id,
        priority: 6,
        enabled: true,
        question: '💬 *Gostaria de compartilhar algo mais ou alguma observação?*\n\n_Escreva livremente ou digite "não" para pular_',
        answer: 'Maravilha! Estou finalizando seu cadastro... ✨',
        action: 'notes',
        triggerType: 'text',
        options: [],
        validations: [
          { type: 'maxLength', value: 500, errorMessage: '⚠️ Texto muito longo. Use no máximo 500 caracteres.' }
        ],
        skipCommand: 'não',
        helpMessage: 'Compartilhe suas observações ou digite "não" para pular'
      }
    ]);

    console.log(`   ✅ ${botVoluntario.name} criado com sucesso!\n`);

    // ========================================
    // RESUMO FINAL
    // ========================================
    console.log('════════════════════════════════════════════════════════');
    console.log('\n📊 RESUMO GERAL:\n');
    console.log(`✅ 3 Bots criados com sucesso!`);
    console.log(`   1. ${botMain.name} (${botMain.type})`);
    console.log(`   2. ${botTorre.name} (${botTorre.type})`);
    console.log(`   3. ${botVoluntario.name} (${botVoluntario.type})`);
    console.log('\n💡 Próximos passos:');
    console.log('   - Configure a lógica de roteamento entre bots');
    console.log('   - Acesse o painel admin para gerenciar os bots');
    console.log('   - Teste o fluxo completo via WhatsApp\n');
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar bots:', error);
    throw error;
  }
}

// Executa o seed
async function run() {
  try {
    await connectDB();
    await seedAllChurchBots();
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
