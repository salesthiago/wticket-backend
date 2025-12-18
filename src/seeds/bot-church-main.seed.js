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

async function seedChurchMainBot() {
  console.log('\n🙏 Criando Bot Principal da Igreja...\n');

  try {
    // Remove bot existente com mesmo nome
    await BotConfig.deleteOne({ name: 'Bot Igreja Principal' });

    // Cria o Bot Config
    const botConfig = await BotConfig.create({
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
        workingDays: [0, 1, 2, 3, 4, 5, 6] // Todos os dias
      },
      commands: {
        cancel: ['cancelar', 'sair', 'parar'],
        restart: ['reiniciar', 'recomeçar', 'voltar'],
        help: ['ajuda', 'help', '?', 'menu']
      }
    });

    console.log(`✅ Bot criado: ${botConfig.name}`);

    // Cria as Auto Responses (fluxo conversacional)
    const autoResponses = [];

    // Passo 1: Captura do Nome
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
      priority: 1,
      enabled: true,
      question: '📝 *Qual é o seu nome?*\n\nPor favor, digite seu nome completo:',
      answer: 'Prazer em conhecê-lo(a), {name}! 😊',
      action: 'name',
      triggerType: 'text',
      options: [],
      validations: [
        {
          type: 'minLength',
          value: 3,
          errorMessage: '⚠️ Por favor, digite seu nome completo (mínimo 3 caracteres).'
        },
        {
          type: 'maxLength',
          value: 100,
          errorMessage: '⚠️ Nome muito longo. Use no máximo 100 caracteres.'
        }
      ],
      helpMessage: 'Digite seu nome completo para continuar'
    }));

    // Passo 2: Menu de Opções
    autoResponses.push(await AutoResponse.create({
      botConfig: botConfig._id,
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
    console.log('\n✅ Bot Principal da Igreja criado com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar bot:', error);
    throw error;
  }
}

// Executa o seed
async function run() {
  try {
    await connectDB();
    await seedChurchMainBot();
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
