# 🤖 Configuração do Fluxo do Bot - Igreja

## 📋 Visão Geral

Este guia explica como configurar o fluxo de conversa do bot para a "Bot Igreja Principal" com as seguintes funcionalidades:

1. ✅ **Verificação de contato** - Pergunta o nome se não estiver cadastrado
2. ✅ **Boas-vindas personalizadas** - Usa o nome do contato
3. 📝 **Opções de atendimento**:
   - Marcar horário na Torre de Oração
   - Cadastro como voluntário

## 🔄 Fluxo Implementado

### Novo Contato (Não Cadastrado)

```
Bot: 👋 Olá! Bem-vindo(a)!
     📝 Para começarmos, por favor, me informe seu nome:

Usuário: João Silva

Bot: 👋 Prazer em conhecê-lo(a), João Silva!
     [Mensagem de boas-vindas configurada no BotConfig]
     [Primeira pergunta - Step 1]
```

### Contato Existente

```
Bot: 👋 Olá, João Silva! [Mensagem de boas-vindas]
     [Primeira pergunta - Step 1]
```

## 🛠️ Configuração das Perguntas (AutoResponses)

Você precisa criar as AutoResponses no banco de dados ou via interface. Aqui está um exemplo de como configurar:

### ⚙️ Configuração do BotConfig

No MongoDB ou via API, configure o bot "Bot Igreja Principal":

```javascript
{
  name: "Bot Igreja Principal",
  enabled: true,
  sessionId: ObjectId("..."), // ID da sessão "local"
  type: "custom",
  welcomeMessage: "Como posso ajudá-lo(a) hoje?",
  defaultResponse: "Desculpe, não entendi. Você pode escolher uma das opções disponíveis.",
  businessHours: {
    enabled: true,
    startTime: "08:00",
    endTime: "18:00",
    workingDays: [0, 1, 2, 3, 4, 5, 6], // Todos os dias (igreja)
    offHoursMessage: "Obrigado por entrar em contato! Nosso horário de atendimento é das 8h às 18h."
  }
}
```

### 📝 AutoResponses (Perguntas do Bot)

#### Step 1: Escolher Serviço (Torre de Oração ou Voluntário)

```javascript
{
  botConfig: ObjectId("..."), // ID do Bot Igreja Principal
  priority: 1,
  triggerType: "option",
  question: "Escolha uma das opções abaixo:\n\n1️⃣ Marcar horário na Torre de Oração\n2️⃣ Quero ser um voluntário",
  answer: "Ótimo! Vamos prosseguir com sua solicitação.",
  action: "service_type", // Armazena a escolha
  enabled: true,
  options: [
    {
      value: "1",
      text: "Torre de Oração",
      nextStep: 2 // Vai para o fluxo de agendamento
    },
    {
      value: "2",
      text: "Voluntário",
      nextStep: 5 // Vai para o fluxo de voluntário
    }
  ]
}
```

---

## 🗓️ Fluxo: Torre de Oração

#### Step 2: Data do Agendamento

```javascript
{
  botConfig: ObjectId("..."),
  priority: 2,
  triggerType: "date",
  question: "📅 Por favor, informe a data desejada para orar na torre:\n\nFormato: DD/MM/AAAA\nExemplo: 25/12/2025",
  answer: "Perfeito! Data registrada.",
  action: "scheduledDate",
  enabled: true,
  validations: [
    {
      type: "futureDate",
      errorMessage: "Por favor, escolha uma data futura."
    },
    {
      type: "businessDays",
      errorMessage: "A Torre de Oração funciona apenas de segunda a sábado. Por favor, escolha outra data."
    }
  ]
}
```

#### Step 3: Horário do Agendamento

```javascript
{
  botConfig: ObjectId("..."),
  priority: 3,
  triggerType: "time",
  question: "🕐 Agora informe o horário desejado:\n\nFormato: HH:mm\nExemplo: 14:30\n\nHorários disponíveis: 08:00 às 17:00",
  answer: "Horário registrado!",
  action: "scheduledTime",
  enabled: true,
  validations: [
    {
      type: "regex",
      value: "^([08-17]):(00|30)$",
      errorMessage: "Por favor, escolha um horário entre 08:00 e 17:00 (intervalos de 30 minutos)."
    }
  ]
}
```

#### Step 4: Motivo da Oração

```javascript
{
  botConfig: ObjectId("..."),
  priority: 4,
  triggerType: "text",
  question: "🙏 Por qual motivo você gostaria de orar?\n\n(Descreva brevemente)",
  answer: "Obrigado! Seu agendamento foi registrado com sucesso. ✅",
  action: "description",
  enabled: true,
  validations: [
    {
      type: "minLength",
      value: 10,
      errorMessage: "Por favor, descreva o motivo com mais detalhes (mínimo 10 caracteres)."
    }
  ]
}
```

---

## 👥 Fluxo: Voluntário

#### Step 5: Nome Completo (Confirmação)

```javascript
{
  botConfig: ObjectId("..."),
  priority: 5,
  triggerType: "text",
  question: "👏 Que maravilha! Queremos você em nossa equipe!\n\n📝 Por favor, confirme seu nome completo:",
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
}
```

#### Step 6: Telefone para Contato

```javascript
{
  botConfig: ObjectId("..."),
  priority: 6,
  triggerType: "phone",
  question: "📱 Qual o melhor telefone para contato?\n\nExemplo: (11) 98765-4321",
  answer: "Telefone registrado!",
  action: "contact_phone",
  enabled: true
}
```

#### Step 7: Área de Interesse

```javascript
{
  botConfig: ObjectId("..."),
  priority: 7,
  triggerType: "option",
  question: "Em qual área você gostaria de atuar como voluntário?\n\n1️⃣ Louvor e Adoração\n2️⃣ Ministério Infantil\n3️⃣ Recepção\n4️⃣ Mídias\n5️⃣ Oração\n6️⃣ Outra área",
  answer: "Perfeito! Seu cadastro foi registrado com sucesso. ✅\n\nEm breve, um líder de ministério entrará em contato com você!",
  action: "volunteer_area",
  enabled: true,
  options: [
    { value: "1", text: "Louvor e Adoração" },
    { value: "2", text: "Ministério Infantil" },
    { value: "3", text: "Recepção" },
    { value: "4", text: "Mídias" },
    { value: "5", text: "Oração" },
    { value: "6", text: "Outra área" }
  ]
}
```

---

## 🚀 Como Inserir no Banco

### Via MongoDB Compass / Studio 3T:

1. Conecte ao banco de dados
2. Acesse a collection `botconfigs`
3. Encontre o bot "Bot Igreja Principal"
4. Copie o `_id` dele
5. Acesse a collection `autoresponses`
6. Insira cada autoresponse acima, substituindo `ObjectId("...")` pelo ID real do bot

### Via Script Node.js:

Crie um arquivo `seed-bot-responses.js`:

```javascript
import mongoose from 'mongoose';
import BotConfig from './src/models/bot-config.model.js';
import AutoResponse from './src/models/auto-response.model.js';

async function seedBotResponses() {
  await mongoose.connect(process.env.MONGO_URI);

  const bot = await BotConfig.findOne({ name: 'Bot Igreja Principal' });

  if (!bot) {
    console.error('Bot não encontrado!');
    return;
  }

  // Limpar responses antigas
  await AutoResponse.deleteMany({ botConfig: bot._id });

  // Inserir novas responses
  const responses = [
    // Copiar os objetos acima...
  ];

  await AutoResponse.insertMany(responses);

  console.log('✅ AutoResponses inseridas com sucesso!');
  mongoose.disconnect();
}

seedBotResponses();
```

Execute:
```bash
node seed-bot-responses.js
```

---

## 📊 Exemplo de Conversa Completa

### Cenário 1: Novo Contato - Torre de Oração

```
👤 Usuário: Oi

🤖 Bot: 👋 Olá! Bem-vindo(a)!
       📝 Para começarmos, por favor, me informe seu nome:

👤 Usuário: Maria Santos

🤖 Bot: 👋 Prazer em conhecê-lo(a), Maria Santos!
       Como posso ajudá-lo(a) hoje?

       Escolha uma das opções abaixo:
       1️⃣ Marcar horário na Torre de Oração
       2️⃣ Quero ser um voluntário

👤 Usuário: 1

🤖 Bot: Ótimo! Vamos prosseguir com sua solicitação.
       📅 Por favor, informe a data desejada para orar na torre:
       Formato: DD/MM/AAAA
       Exemplo: 25/12/2025

👤 Usuário: 20/12/2025

🤖 Bot: Perfeito! Data registrada.
       🕐 Agora informe o horário desejado:
       Formato: HH:mm
       Exemplo: 14:30
       Horários disponíveis: 08:00 às 17:00

👤 Usuário: 14:30

🤖 Bot: Horário registrado!
       🙏 Por qual motivo você gostaria de orar?
       (Descreva brevemente)

👤 Usuário: Quero orar pela minha família e pela igreja

🤖 Bot: Obrigado! Seu agendamento foi registrado com sucesso. ✅

       ✅ *Agendamento confirmado!*

       📅 *Data:* 20/12/2025
       🕐 *Horário:* 14:30
       📝 *Descrição:* Quero orar pela minha família e pela igreja

       Você receberá um lembrete 24h antes do horário agendado.

       Obrigado! 😊
```

### Cenário 2: Contato Existente - Voluntário

```
👤 Usuário: Olá

🤖 Bot: 👋 Olá, João Silva! Como posso ajudá-lo(a) hoje?

       Escolha uma das opções abaixo:
       1️⃣ Marcar horário na Torre de Oração
       2️⃣ Quero ser um voluntário

👤 Usuário: 2

🤖 Bot: 👏 Que maravilha! Queremos você em nossa equipe!
       📝 Por favor, confirme seu nome completo:

👤 Usuário: João Silva Santos

🤖 Bot: Nome registrado!
       📱 Qual o melhor telefone para contato?
       Exemplo: (11) 98765-4321

👤 Usuário: (62) 99999-8888

🤖 Bot: Telefone registrado!
       Em qual área você gostaria de atuar como voluntário?

       1️⃣ Louvor e Adoração
       2️⃣ Ministério Infantil
       3️⃣ Recepção
       4️⃣ Mídias
       5️⃣ Oração
       6️⃣ Outra área

👤 Usuário: 1

🤖 Bot: Perfeito! Seu cadastro foi registrado com sucesso. ✅
       Em breve, um líder de ministério entrará em contato com você!
```

---

## 🔧 Personalização

### Alterar mensagens:

Edite os campos `question` e `answer` de cada AutoResponse.

### Adicionar mais opções:

Adicione novos objetos ao array `options`.

### Alterar validações:

Modifique o array `validations` de cada step.

---

## ⚠️ Comandos Especiais

O bot reconhece automaticamente estes comandos a qualquer momento:

- `sair`
- `cancelar`
- `atendente`
- `humano`
- `falar com atendente`
- `operador`

Quando o usuário digitar qualquer um desses, ele será transferido para atendimento humano.

---

## 📝 Notas Importantes

1. **Priority** deve ser único e sequencial (1, 2, 3, 4...)
2. **Action** é o nome do campo que será salvo (ex: `scheduledDate`, `description`)
3. **NextStep** permite criar fluxos condicionais
4. **Validations** garantem que os dados estejam no formato correto
5. O último step (sem nextStep) finaliza a conversa e cria o appointment

---

**Data de criação:** 2025-12-19
**Versão:** 1.0
