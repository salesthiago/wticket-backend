import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BotConfig from './src/models/bot-config.model.js';
import AutoResponse from './src/models/auto-response.model.js';

dotenv.config();

async function seedBotIgreja() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado ao MongoDB');

    // Busca o bot
    const bot = await BotConfig.findOne({ name: 'Bot Igreja Principal' });

    if (!bot) {
      console.error('❌ Bot "Bot Igreja Principal" não encontrado!');
      console.log('💡 Crie o bot primeiro via interface ou banco de dados');
      mongoose.disconnect();
      return;
    }

    console.log(`✅ Bot encontrado: ${bot.name} (${bot._id})`);

    // Limpar responses antigas
    const deleted = await AutoResponse.deleteMany({ botConfig: bot._id });
    console.log(`🗑️  ${deleted.deletedCount} AutoResponses antigas removidas`);

    // Criar novas responses
    const responses = [
      // Step 1: Escolher Serviço (Torre de Oração ou Voluntário)
      {
        botConfig: bot._id,
        priority: 1,
        triggerType: 'option',
        question: 'Escolha uma das opções abaixo:\n\n1️⃣ Marcar horário na Torre de Oração\n2️⃣ Quero ser um voluntário',
        answer: 'Ótimo! Vamos prosseguir com sua solicitação.',
        action: 'service_type',
        enabled: true,
        options: [
          {
            value: '1',
            text: 'Torre de Oração',
            nextStep: 2
          },
          {
            value: '2',
            text: 'Voluntário',
            nextStep: 5
          }
        ]
      },

      // ===== FLUXO: TORRE DE ORAÇÃO =====

      // Step 2: Data do Agendamento
      {
        botConfig: bot._id,
        priority: 2,
        triggerType: 'date',
        question: '📅 Por favor, informe a data desejada para orar na torre:\n\nFormato: DD/MM/AAAA\nExemplo: 25/12/2025',
        answer: 'Perfeito! Data registrada.',
        action: 'scheduledDate',
        enabled: true,
        validations: [
          {
            type: 'futureDate',
            errorMessage: 'Por favor, escolha uma data futura.'
          }
        ]
      },

      // Step 3: Horário do Agendamento
      {
        botConfig: bot._id,
        priority: 3,
        triggerType: 'time',
        question: '🕐 Agora informe o horário desejado:\n\nFormato: HH:mm\nExemplo: 14:30\n\nHorários disponíveis: 08:00 às 17:00',
        answer: 'Horário registrado!',
        action: 'scheduledTime',
        enabled: true
      },

      // Step 4: Motivo da Oração
      {
        botConfig: bot._id,
        priority: 4,
        triggerType: 'text',
        question: '🙏 Por qual motivo você gostaria de orar?\n\n(Descreva brevemente)',
        answer: 'Obrigado! Seu agendamento foi registrado com sucesso. ✅',
        action: 'description',
        enabled: true,
        validations: [
          {
            type: 'minLength',
            value: 10,
            errorMessage: 'Por favor, descreva o motivo com mais detalhes (mínimo 10 caracteres).'
          }
        ]
      },

      // ===== FLUXO: VOLUNTÁRIO =====

      // Step 5: Nome Completo (Confirmação)
      {
        botConfig: bot._id,
        priority: 5,
        triggerType: 'text',
        question: '👏 Que maravilha! Queremos você em nossa equipe!\n\n📝 Por favor, confirme seu nome completo:',
        answer: 'Nome registrado!',
        action: 'full_name',
        enabled: true,
        validations: [
          {
            type: 'minLength',
            value: 5,
            errorMessage: 'Por favor, informe seu nome completo.'
          }
        ]
      },

      // Step 6: Telefone para Contato
      {
        botConfig: bot._id,
        priority: 6,
        triggerType: 'phone',
        question: '📱 Qual o melhor telefone para contato?\n\nExemplo: (11) 98765-4321',
        answer: 'Telefone registrado!',
        action: 'contact_phone',
        enabled: true
      },

      // Step 7: Área de Interesse
      {
        botConfig: bot._id,
        priority: 7,
        triggerType: 'option',
        question: 'Em qual área você gostaria de atuar como voluntário?\n\n1️⃣ Louvor e Adoração\n2️⃣ Ministério Infantil\n3️⃣ Recepção\n4️⃣ Mídias\n5️⃣ Oração\n6️⃣ Outra área',
        answer: 'Perfeito! Seu cadastro foi registrado com sucesso. ✅\n\nEm breve, um líder de ministério entrará em contato com você!',
        action: 'volunteer_area',
        enabled: true,
        options: [
          { value: '1', text: 'Louvor e Adoração' },
          { value: '2', text: 'Ministério Infantil' },
          { value: '3', text: 'Recepção' },
          { value: '4', text: 'Mídias' },
          { value: '5', text: 'Oração' },
          { value: '6', text: 'Outra área' }
        ]
      }
    ];

    console.log(`📝 Inserindo ${responses.length} AutoResponses...`);
    const inserted = await AutoResponse.insertMany(responses);
    console.log(`✅ ${inserted.length} AutoResponses inseridas com sucesso!`);

    console.log('\n📋 Resumo:');
    console.log(`   Bot: ${bot.name}`);
    console.log(`   Responses: ${inserted.length}`);
    console.log(`   Steps configurados:`);
    console.log(`     - Step 1: Escolher serviço (Torre de Oração ou Voluntário)`);
    console.log(`     - Steps 2-4: Fluxo Torre de Oração`);
    console.log(`     - Steps 5-7: Fluxo Voluntário`);

    console.log('\n🎉 Seed concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao fazer seed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

seedBotIgreja();
