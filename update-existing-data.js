import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from './src/models/session.model.js';
import BotConfig from './src/models/bot-config.model.js';

dotenv.config();

async function updateExistingData() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // ===== ATUALIZAR SESSIONS =====
    console.log('📋 Atualizando Sessions...');

    const sessions = await Session.find({});
    console.log(`   Encontradas ${sessions.length} sessão(ões)`);

    let sessionsUpdated = 0;
    for (const session of sessions) {
      let needsUpdate = false;

      if (!session.initiationMessage) {
        session.initiationMessage = '👋 Olá! Bem-vindo(a) ao nosso atendimento automático.\n\nPara continuar, por favor digite: PROSSEGUIR';
        needsUpdate = true;
      }

      if (!session.initiationKeyword) {
        session.initiationKeyword = 'PROSSEGUIR';
        needsUpdate = true;
      }

      if (!session.finalizationMessage) {
        session.finalizationMessage = '✅ Atendimento finalizado.\n\nObrigado pelo contato! Para iniciar um novo atendimento, envie outra mensagem.';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await session.save();
        sessionsUpdated++;
        console.log(`   ✅ Sessão "${session.name}" atualizada`);
      }
    }

    console.log(`   📊 Total de sessões atualizadas: ${sessionsUpdated}\n`);

    // ===== ATUALIZAR BOT CONFIGS =====
    console.log('🤖 Atualizando BotConfigs...');

    const botConfigs = await BotConfig.find({});
    console.log(`   Encontrados ${botConfigs.length} bot(s)`);

    let botsUpdated = 0;
    for (const bot of botConfigs) {
      let needsUpdate = false;

      if (bot.isActive === undefined || bot.isActive === null) {
        bot.isActive = true;
        needsUpdate = true;
      }

      // Sugerir triggerKeyword baseado no nome (se não existir)
      if (!bot.triggerKeyword) {
        // Gerar keyword do nome (ex: "Bot Torre de Oração" → "ORACAO")
        const nameWords = bot.name.split(' ');

        // Pegar a última palavra significativa (geralmente o serviço)
        let keyword = nameWords[nameWords.length - 1]
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
          .toUpperCase();

        // Casos especiais
        if (bot.name.toLowerCase().includes('torre')) {
          keyword = 'ORACAO';
        } else if (bot.name.toLowerCase().includes('voluntar')) {
          keyword = 'VOLUNTARIOS';
        } else if (bot.name.toLowerCase().includes('doacoes') || bot.name.toLowerCase().includes('doação')) {
          keyword = 'DOACOES';
        } else if (bot.name.toLowerCase().includes('agenda')) {
          keyword = 'AGENDAR';
        }

        bot.triggerKeyword = keyword;
        needsUpdate = true;
        console.log(`   💡 Bot "${bot.name}" → keyword sugerida: "${keyword}"`);
      }

      if (needsUpdate) {
        await bot.save();
        botsUpdated++;
        console.log(`   ✅ Bot "${bot.name}" atualizado`);
      }
    }

    console.log(`   📊 Total de bots atualizados: ${botsUpdated}\n`);

    // ===== RESUMO =====
    console.log('📊 RESUMO DA ATUALIZAÇÃO:');
    console.log(`   Sessions atualizadas: ${sessionsUpdated}/${sessions.length}`);
    console.log(`   BotConfigs atualizados: ${botsUpdated}/${botConfigs.length}`);
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   1. Verifique as keywords dos bots e ajuste se necessário');
    console.log('   2. Personalize as mensagens de iniciação/finalização das sessões');
    console.log('   3. Configure as AutoResponses com as novas ações (action, targetBotId)');
    console.log('\n🎉 Atualização concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao atualizar dados:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

updateExistingData();
