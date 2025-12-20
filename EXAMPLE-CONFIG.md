# 📝 Exemplo Prático de Configuração

## Cenário: Igreja com 3 Bots

1. **Torre de Oração** - Agendar horário na torre
2. **Voluntários** - Cadastro de novos voluntários
3. **Dízimos e Ofertas** - Informações sobre doações

---

## 🗂️ Passo 1: Configurar Sessão

```javascript
// MongoDB - Collection: sessions
db.sessions.updateOne(
  { name: "local" },  // ⚠️ Ajustar nome da sua sessão
  {
    $set: {
      initiationMessage: "👋 *Bem-vindo à Igreja Deus Provedor!*\n\n🤖 Este é nosso atendimento automatizado.\n\nPara continuar, por favor digite: *CONTINUAR*",
      initiationKeyword: "CONTINUAR",
      finalizationMessage: "✨ *Que Deus te abençoe!*\n\n✅ Atendimento finalizado com sucesso.\n\n📱 Para iniciar um novo atendimento, envie outra mensagem a qualquer momento."
    }
  }
);
```

---

## 🤖 Passo 2: Configurar Bots

### Bot 1: Torre de Oração

```javascript
// Collection: botconfigs
db.botconfigs.updateOne(
  { name: "Bot Torre de Oração" },
  {
    $set: {
      triggerKeyword: "ORACAO",
      isActive: true,
      enabled: true,
      welcomeMessage: "🙏 *Você escolheu Torre de Oração*\n\nVamos agendar seu horário para orar conosco!",
      confirmationMessage: "🎉 Agendamento confirmado na Torre de Oração!",
      businessHours: {
        enabled: true,
        startTime: "06:00",
        endTime: "22:00",
        workingDays: [0, 1, 2, 3, 4, 5, 6],  // Todos os dias
        offHoursMessage: "A Torre de Oração funciona das 6h às 22h. Por favor, agende em um horário válido."
      }
    }
  }
);
```

### Bot 2: Voluntários

```javascript
db.botconfigs.updateOne(
  { name: "Bot Voluntários" },
  {
    $set: {
      triggerKeyword: "VOLUNTARIOS",
      isActive: true,
      enabled: true,
      welcomeMessage: "👏 *Que maravilha!*\n\nQueremos você na nossa equipe de voluntários!",
      confirmationMessage: "✅ Cadastro de voluntário realizado! Em breve um líder entrará em contato.",
      businessHours: {
        enabled: false  // Aceita inscrições 24/7
      }
    }
  }
);
```

### Bot 3: Dízimos e Ofertas

```javascript
db.botconfigs.updateOne(
  { name: "Bot Dízimos" },
  {
    $set: {
      triggerKeyword: "DOACOES",
      isActive: true,
      enabled: true,
      welcomeMessage: "💰 *Informações sobre Dízimos e Ofertas*\n\nObrigado por seu coração generoso!",
      confirmationMessage: "✅ Informações enviadas! Deus abençoe sua oferta.",
      businessHours: {
        enabled: false
      }
    }
  }
);
```

---

## 📋 Passo 3: Configurar AutoResponses

### Bot Torre de Oração - Perguntas

```javascript
// Collection: autoresponses

// Pergunta 1: Data
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Torre de Oração
  priority: 1,
  triggerType: "date",
  question: "📅 *Em que data você gostaria de visitar a Torre?*\n\nPor favor, informe no formato: DD/MM/AAAA\nExemplo: 25/12/2025",
  answer: "✅ Data registrada!",
  action: "scheduledDate",
  enabled: true,
  validations: [
    {
      type: "futureDate",
      errorMessage: "⚠️ Por favor, escolha uma data futura."
    }
  ]
});

// Pergunta 2: Horário
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Torre de Oração
  priority: 2,
  triggerType: "option",
  question: "🕐 *Qual turno você prefere?*",
  answer: "Horário registrado!",
  action: "scheduledTime",
  enabled: true,
  options: [
    {
      value: "1",
      text: "Manhã (6h - 12h)",
      action: "nextStep"
    },
    {
      value: "2",
      text: "Tarde (12h - 18h)",
      action: "nextStep"
    },
    {
      value: "3",
      text: "Noite (18h - 22h)",
      action: "nextStep"
    }
  ]
});

// Pergunta 3: Motivo
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Torre de Oração
  priority: 3,
  triggerType: "text",
  question: "🙏 *Por qual motivo você gostaria de orar?*\n\n(Descreva brevemente)",
  answer: "Obrigado por compartilhar! Estaremos orando por você.",
  action: "description",
  enabled: true,
  validations: [
    {
      type: "minLength",
      value: 5,
      errorMessage: "Por favor, descreva com um pouco mais de detalhes."
    }
  ]
});
```

### Bot Voluntários - Perguntas

```javascript
// Pergunta 1: Nome Completo
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Voluntários
  priority: 1,
  triggerType: "text",
  question: "📝 *Por favor, confirme seu nome completo:*",
  answer: "Nome registrado!",
  action: "full_name",
  enabled: true,
  validations: [
    {
      type: "minLength",
      value: 5,
      errorMessage: "Por favor, informe seu nome completo."
    }
  ]
});

// Pergunta 2: Área de Interesse
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Voluntários
  priority: 2,
  triggerType: "option",
  question: "🎯 *Em qual área você gostaria de atuar?*",
  answer: "Excelente escolha!",
  action: "volunteer_area",
  enabled: true,
  options: [
    {
      value: "1",
      text: "Louvor e Adoração 🎤",
      action: "nextStep"
    },
    {
      value: "2",
      text: "Ministério Infantil 👶",
      action: "nextStep"
    },
    {
      value: "3",
      text: "Recepção 🤝",
      action: "nextStep"
    },
    {
      value: "4",
      text: "Mídias 📱",
      action: "nextStep"
    },
    {
      value: "5",
      text: "Torre de Oração 🙏",
      action: "callBot",  // ⬅️ Chama o bot de Torre de Oração
      targetBotId: ObjectId("...")  // ⬅️ ID do Bot Torre de Oração
    },
    {
      value: "6",
      text: "Não tenho certeza ainda",
      action: "finish"  // ⬅️ Finaliza sem cadastrar
    }
  ]
});

// Pergunta 3: Telefone
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Voluntários
  priority: 3,
  triggerType: "phone",
  question: "📱 *Qual seu telefone para contato?*\n\nExemplo: (62) 99999-8888",
  answer: "Perfeito! Telefone registrado.",
  action: "contact_phone",
  enabled: true
});

// Pergunta 4: Disponibilidade
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Voluntários
  priority: 4,
  triggerType: "option",
  question: "📅 *Qual sua disponibilidade?*",
  answer: "✅ Cadastro completo! Em breve um líder entrará em contato.",
  action: "availability",
  enabled: true,
  options: [
    {
      value: "1",
      text: "Domingos pela manhã",
      action: "nextStep"
    },
    {
      value: "2",
      text: "Domingos à noite",
      action: "nextStep"
    },
    {
      value: "3",
      text: "Dias de semana",
      action: "nextStep"
    },
    {
      value: "4",
      text: "Qualquer horário",
      action: "nextStep"
    }
  ]
});
```

### Bot Dízimos - Perguntas

```javascript
// Pergunta 1: Tipo de Informação
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Dízimos
  priority: 1,
  triggerType: "option",
  question: "💰 *O que você gostaria de saber?*",
  answer: "Entendido!",
  action: "info_type",
  enabled: true,
  options: [
    {
      value: "1",
      text: "Dados bancários para transferência",
      action: "nextStep"
    },
    {
      value: "2",
      text: "Como doar via PIX",
      action: "nextStep"
    },
    {
      value: "3",
      text: "Informações sobre dízimo",
      action: "nextStep"
    },
    {
      value: "4",
      text: "Voltar ao menu principal",
      action: "finish"  // ⬅️ Finaliza e volta ao menu
    }
  ]
});

// Pergunta 2: Enviar Informações (baseado na escolha)
db.autoresponses.insertOne({
  botConfig: ObjectId("..."),  // ⚠️ ID do Bot Dízimos
  priority: 2,
  triggerType: "text",
  question: "📋 *Aqui estão as informações:*\n\n" +
            "🏦 *Banco:* Banco do Brasil\n" +
            "🔢 *Agência:* 1234-5\n" +
            "🔢 *Conta:* 67890-1\n" +
            "👤 *Titular:* Igreja Deus Provedor\n" +
            "📱 *PIX:* igreja@deusprovedor.com.br\n\n" +
            "*Gostaria de mais alguma informação?*\n" +
            "Digite *SIM* para continuar ou *NAO* para finalizar.",
  answer: "",
  action: "more_info",
  enabled: true
});
```

---

## 🧪 Como Testar

### 1. Executar Script de Atualização

```bash
cd backend
node update-existing-data.js
```

### 2. Aplicar Configurações Acima

Copie e cole os comandos MongoDB acima, ajustando:
- Nome da sessão (`"local"` → seu nome)
- ObjectIds dos bots
- Mensagens personalizadas

### 3. Reiniciar Servidor

```bash
npm start
```

### 4. Testar no WhatsApp

**Conversa Completa Esperada:**

```
👤 Você: Oi

🤖 Bot: 👋 *Bem-vindo à Igreja Deus Provedor!*

       🤖 Este é nosso atendimento automatizado.

       Para continuar, por favor digite: *CONTINUAR*

👤 Você: CONTINUAR

🤖 Bot: 📝 Para continuar, por favor, informe seu nome:

👤 Você: João Silva

🤖 Bot: 👋 Olá, *João Silva*! Que bom ter você aqui!

       📋 *Em qual das opções posso te ajudar?*

       ▪️ Para *Bot Torre de Oração*, digite: *ORACAO*
       ▪️ Para *Bot Voluntários*, digite: *VOLUNTARIOS*
       ▪️ Para *Bot Dízimos*, digite: *DOACOES*

👤 Você: ORACAO

🤖 Bot: 🙏 *Você escolheu Torre de Oração*

       Vamos agendar seu horário para orar conosco!

       📅 *Em que data você gostaria de visitar a Torre?*

       Por favor, informe no formato: DD/MM/AAAA
       Exemplo: 25/12/2025

👤 Você: 20/12/2025

🤖 Bot: ✅ Data registrada!

       🕐 *Qual turno você prefere?*

       1 - Manhã (6h - 12h)
       2 - Tarde (12h - 18h)
       3 - Noite (18h - 22h)

👤 Você: 2

🤖 Bot: Horário registrado!

       🙏 *Por qual motivo você gostaria de orar?*

       (Descreva brevemente)

👤 Você: Orar pela minha família e pela igreja

🤖 Bot: Obrigado por compartilhar! Estaremos orando por você.

       🎉 *Agendamento confirmado na Torre de Oração!*

       📅 *Data:* 20/12/2025
       🕐 *Horário:* Tarde (12h - 18h)
       📝 *Motivo:* Orar pela minha família e pela igreja

       ✅ Agendamento realizado com sucesso!

🤖 Bot: ✨ *Que Deus te abençoe!*

       ✅ Atendimento finalizado com sucesso.

       📱 Para iniciar um novo atendimento, envie outra mensagem a qualquer momento.
```

---

## 📊 Verificar Configuração

```javascript
// Verificar sessão
db.sessions.findOne({ name: "local" }, {
  name: 1,
  initiationKeyword: 1,
  initiationMessage: 1
});

// Verificar bots
db.botconfigs.find({}, {
  name: 1,
  triggerKeyword: 1,
  isActive: 1,
  enabled: 1
}).pretty();

// Verificar AutoResponses de um bot
db.autoresponses.find(
  { botConfig: ObjectId("...") },
  { priority: 1, question: 1, action: 1 }
).sort({ priority: 1 });
```

---

**Pronto! Com essa configuração você terá um sistema completo funcionando!** 🎉
