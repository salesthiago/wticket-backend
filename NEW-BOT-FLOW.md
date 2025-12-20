# 🤖 Novo Fluxo de Bot - Sistema Completo

## 📋 Resumo das Mudanças

Implementamos um sistema completo e dinâmico de atendimento por bot com as seguintes funcionalidades:

1. ✅ **Mensagem de Iniciação** - Cada sessão tem sua própria mensagem e palavra-chave
2. ✅ **Cadastro de Contato** - Pergunta o nome apenas para números não cadastrados
3. ✅ **Menu Dinâmico de Bots** - Lista todos os bots vinculados à sessão
4. ✅ **Seleção por Palavra-Chave** - Usuário digita palavra-chave para ativar bot
5. ✅ **Ações Dinâmicas** - Respostas podem chamar outros bots ou finalizar
6. ✅ **Mensagem de Finalização** - Mensagem personalizada ao encerrar

---

## 🎯 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    MENSAGEM DO USUÁRIO                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  ETAPA 1: INITIATION                                         │
│  Bot: "Olá! Para continuar, digite: PROSSEGUIR"            │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
  Palavra CORRETA                       Palavra INCORRETA
        │                                       │
        ▼                                       │
  Contato EXISTE?                              │
        │                                       │
   ┌────┴────┐                                │
   │         │                                 │
  SIM       NÃO                                │
   │         │                                 │
   │         ▼                                 │
   │  ┌──────────────────────────┐            │
   │  │ ETAPA 2: NAME            │            │
   │  │ Bot: "Informe seu nome:" │            │
   │  └─────────┬────────────────┘            │
   │            │                              │
   │            ▼                              │
   │       Cria Contato                        │
   │            │                              │
   └────────────┴──────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  ETAPA 3: MENU                                               │
│  Bot: "Olá, NOME! Que bom ter você aqui!"                   │
│       "Em qual das opções posso te ajudar?"                 │
│       "▪️ Para Torre de Oração, digite: ORACAO"            │
│       "▪️ Para Voluntários, digite: VOLUNTARIOS"           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                    Usuário digita palavra
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
  Palavra VÁLIDA                         Palavra INVÁLIDA
        │                                       │
        ▼                                       │
┌──────────────────────┐                       │
│ ETAPA 4: BOT_ACTIVE  │                       │
│ (Bot selecionado)    │                       │
└───────┬──────────────┘                       │
        │                                       │
        ▼                                       │
  Pergunta 1 → Pergunta 2 → ... → Finaliza     │
        │                                       │
        │                                       │
    Opção com ação?                            │
        │                                       │
   ┌────┴────┐                                 │
   │         │                                  │
nextStep  callBot  finish                      │
   │         │         │                        │
   │         │         └──────┐                 │
   │         ▼                │                 │
   │    Troca de bot          │                 │
   │         │                │                 │
   └─────────┴────────────────┴─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  FINALIZAÇÃO                                                 │
│  - Cria appointment/registro                                 │
│  - Fecha ticket                                              │
│  - Envia mensagem de finalização                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Modelos Modificados

### 1. Session Model

**Campos adicionados:**

```javascript
{
  initiationMessage: {
    type: String,
    default: '👋 Olá! Bem-vindo(a) ao nosso atendimento automático.\n\nPara continuar, por favor digite: PROSSEGUIR'
  },
  initiationKeyword: {
    type: String,
    default: 'PROSSEGUIR'
  },
  finalizationMessage: {
    type: String,
    default: '✅ Atendimento finalizado.\n\nObrigado pelo contato! Para iniciar um novo atendimento, envie outra mensagem.'
  }
}
```

**Como configurar:**

- Via MongoDB Compass/Studio 3T:
  1. Edite o documento da sessão
  2. Adicione os campos acima com seus valores personalizados

- Via API (futuro):
  ```javascript
  PUT /api/sessions/:sessionName
  {
    "initiationMessage": "Olá! Este é o atendimento da Igreja. Digite CONTINUAR para prosseguir.",
    "initiationKeyword": "CONTINUAR",
    "finalizationMessage": "Que Deus te abençoe! Atendimento encerrado."
  }
  ```

### 2. BotConfig Model

**Campos adicionados:**

```javascript
{
  triggerKeyword: {
    type: String,
    required: false,
    uppercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}
```

**Exemplo de configuração:**

```javascript
{
  name: "Bot Torre de Oração",
  triggerKeyword: "ORACAO",  // ⚠️ OBRIGATÓRIO para aparecer no menu
  isActive: true,
  enabled: true,
  sessionId: ObjectId("..."),
  welcomeMessage: "Vamos agendar sua visita à Torre de Oração!"
}
```

### 3. AutoResponse Model (opções com ações)

**Campos adicionados nas options:**

```javascript
{
  options: [
    {
      value: "1",
      text: "Sim, quero agendar",
      action: "nextStep"  // Continua para próximo step
    },
    {
      value: "2",
      text: "Quero ser voluntário",
      action: "callBot",  // Chama outro bot
      targetBotId: ObjectId("...")  // ID do bot de voluntários
    },
    {
      value: "3",
      text: "Não, obrigado",
      action: "finish"  // Finaliza atendimento
    }
  ]
}
```

---

## 🚀 Como Configurar

### Passo 1: Atualizar Sessão

```javascript
// MongoDB - Collection: sessions
db.sessions.updateOne(
  { name: "local" },
  {
    $set: {
      initiationMessage: "👋 Olá! Este é o atendimento automatizado da Igreja Deus Provedor.\n\nPara continuar, digite: PROSSEGUIR",
      initiationKeyword: "PROSSEGUIR",
      finalizationMessage: "✅ Atendimento finalizado. Que Deus te abençoe!\n\nPara novo atendimento, envie outra mensagem."
    }
  }
);
```

### Passo 2: Configurar Bots com Palavras-Chave

```javascript
// MongoDB - Collection: botconfigs
db.botconfigs.updateOne(
  { name: "Bot Torre de Oração" },
  {
    $set: {
      triggerKeyword: "ORACAO",
      isActive: true,
      enabled: true
    }
  }
);

db.botconfigs.updateOne(
  { name: "Bot Voluntários" },
  {
    $set: {
      triggerKeyword: "VOLUNTARIOS",
      isActive: true,
      enabled: true
    }
  }
);
```

### Passo 3: Configurar AutoResponses com Ações

```javascript
// MongoDB - Collection: autoresponses

// Exemplo: Pergunta que chama outro bot
{
  botConfig: ObjectId("..."),  // ID do Bot Torre de Oração
  priority: 3,
  triggerType: "option",
  question: "Você já é voluntário na igreja?",
  answer: "Entendi!",
  action: "volunteer_status",
  options: [
    {
      value: "1",
      text: "Sim, já sou voluntário",
      action: "nextStep"  // Continua no mesmo bot
    },
    {
      value: "2",
      text: "Não, quero me cadastrar",
      action: "callBot",  // Chama bot de voluntários
      targetBotId: ObjectId("...")  // ID do Bot Voluntários
    },
    {
      value: "3",
      text: "Não tenho interesse",
      action: "finish"  // Finaliza atendimento
    }
  ]
}
```

---

## 📱 Exemplo de Conversa Completa

### Cenário: Novo Contato - Torre de Oração

```
👤 Usuário: Oi

🤖 Bot: 👋 Olá! Este é o atendimento automatizado da Igreja Deus Provedor.
       Para continuar, digite: PROSSEGUIR

👤 Usuário: PROSSEGUIR

🤖 Bot: 📝 Para continuar, por favor, informe seu nome:

👤 Usuário: Maria Santos

🤖 Bot: 👋 Olá, Maria Santos! Que bom ter você aqui!

       📋 Em qual das opções posso te ajudar?

       ▪️ Para Torre de Oração, digite: ORACAO
       ▪️ Para Voluntários, digite: VOLUNTARIOS

👤 Usuário: ORACAO

🤖 Bot: Vamos agendar sua visita à Torre de Oração!

       📅 Por favor, informe a data desejada:
       Formato: DD/MM/AAAA
       Exemplo: 25/12/2025

👤 Usuário: 20/12/2025

🤖 Bot: Perfeito! Data registrada.

       🕐 Agora informe o horário:
       Formato: HH:mm
       Exemplo: 14:30

👤 Usuário: 14:30

🤖 Bot: Horário registrado!

       🙏 Por qual motivo você gostaria de orar?

👤 Usuário: Orar pela minha família

🤖 Bot: ✅ Agendamento realizado com sucesso!

       📅 Data: 20/12/2025
       🕐 Horário: 14:30
       📝 Detalhes: Orar pela minha família

       Você receberá um lembrete antes do horário agendado.

       Obrigado! 😊

🤖 Bot: ✅ Atendimento finalizado. Que Deus te abençoe!

       Para novo atendimento, envie outra mensagem.
```

### Cenário: Contato Existente - Voluntário

```
👤 Usuário: Olá

🤖 Bot: 👋 Olá! Este é o atendimento automatizado da Igreja Deus Provedor.
       Para continuar, digite: PROSSEGUIR

👤 Usuário: PROSSEGUIR

🤖 Bot: 👋 Olá, João Silva! Que bom ter você aqui!

       📋 Em qual das opções posso te ajudar?

       ▪️ Para Torre de Oração, digite: ORACAO
       ▪️ Para Voluntários, digite: VOLUNTARIOS

👤 Usuário: VOLUNTARIOS

🤖 Bot: 👏 Que maravilha! Queremos você em nossa equipe!

       [continua fluxo de voluntário...]
```

### Cenário: Palavra-chave Inválida

```
👤 Usuário: oi

🤖 Bot: 👋 Olá! Este é o atendimento automatizado da Igreja Deus Provedor.
       Para continuar, digite: PROSSEGUIR

👤 Usuário: sim

🤖 Bot: 👋 Olá! Este é o atendimento automatizado da Igreja Deus Provedor.
       Para continuar, digite: PROSSEGUIR

👤 Usuário: PROSSEGUIR

🤖 Bot: [continua...]
```

---

## 🔄 Ações Dinâmicas

### action: "nextStep" (padrão)

Continua no mesmo bot, vai para o próximo step.

```javascript
{
  value: "1",
  text: "Sim, continuar",
  action: "nextStep"  // Pode omitir, é o padrão
}
```

### action: "callBot"

Troca para outro bot, mantendo o contexto do usuário.

```javascript
{
  value: "2",
  text: "Quero voluntário",
  action: "callBot",
  targetBotId: ObjectId("676...")  // ID do Bot Voluntários
}
```

**O que acontece:**
1. Finaliza o bot atual
2. Limpa os dados coletados
3. Inicia o bot de destino
4. Envia welcome message + primeira pergunta

### action: "finish"

Finaliza o atendimento imediatamente.

```javascript
{
  value: "3",
  text: "Não, obrigado",
  action: "finish"
}
```

**O que acontece:**
1. Finaliza o bot
2. Fecha o ticket como "finalizado pelo usuário"
3. Envia mensagem de finalização da sessão
4. Limpa a sessão do usuário

---

## 🎛️ Configuração via Interface (Futuro)

### Frontend - Formulário de Sessão

Adicionar campos:

```typescript
interface SessionForm {
  name: string;
  initiationMessage: string;      // ⬅️ NOVO
  initiationKeyword: string;       // ⬅️ NOVO
  finalizationMessage: string;     // ⬅️ NOVO
}
```

### Frontend - Formulário de BotConfig

Adicionar campos:

```typescript
interface BotConfigForm {
  name: string;
  sessionId: string;
  triggerKeyword: string;          // ⬅️ NOVO (obrigatório)
  isActive: boolean;               // ⬅️ NOVO
  welcomeMessage: string;
  // ... outros campos
}
```

### Frontend - Formulário de AutoResponse

Modificar options:

```typescript
interface OptionForm {
  value: string;
  text: string;
  action: 'nextStep' | 'callBot' | 'finish';  // ⬅️ NOVO
  targetBotId?: string;                        // ⬅️ NOVO (quando action = callBot)
}
```

---

## 🐛 Troubleshooting

### Problema 1: Bot não aparece no menu

**Causas:**
- `triggerKeyword` não está configurado
- `isActive` está false
- `enabled` está false
- `sessionId` não corresponde à sessão

**Solução:**
```javascript
db.botconfigs.updateOne(
  { name: "Nome do Bot" },
  {
    $set: {
      triggerKeyword: "PALAVRA",  // ⚠️ Obrigatório
      isActive: true,
      enabled: true,
      sessionId: ObjectId("...")  // ID correto da sessão
    }
  }
);
```

### Problema 2: Palavra-chave não reconhecida

**Causas:**
- Case sensitive - usuário digitou "oracao" mas está configurado "ORACAO"
- Espaços antes/depois

**Obs:** O sistema já converte para uppercase e faz trim(), mas pode haver problemas se:
- Bot foi criado sem `triggerKeyword`
- Há caracteres especiais

**Solução:**
Use palavras simples, sem acentos:
- ✅ ORACAO (não ORAÇÃO)
- ✅ VOLUNTARIOS (não VOLUNTÁRIOS)

### Problema 3: Finalização não envia mensagem

**Verificar:**
1. Se `session.finalizationMessage` está configurado
2. Se o bot retornou `completed: true` ou `finishedByUser: true`
3. Logs do whatsapp.service.js

---

## 📊 Logs Esperados

### Fluxo Normal

```
[INFO]: [556294421733] 🤖 Sessão local possui bots ativos - processando com bot-agenda
[INFO]: [556294421733] 📋 Ticket criado: 676... - Status: in_progress (bot atendendo)
[DEBUG]: [556294421733] Step atual: INITIATION, Mensagem: oi
[INFO]: [556294421733] Iniciação OK, mas contato não cadastrado - solicitando nome
[DEBUG]: [556294421733] Step atual: NAME, Mensagem: Maria
[INFO]: ✅ Contato criado: Maria (556294421733)
[DEBUG]: [556294421733] Step atual: MENU, Mensagem: ORACAO
[INFO]: [556294421733] Bot selecionado: Bot Torre de Oração (ORACAO)
[DEBUG]: [556294421733] Step atual: BOT_ACTIVE, Mensagem: 20/12/2025
[INFO]: ✅ Ticket 676... finalizado com sucesso pelo bot
```

---

## ✅ Checklist de Implementação

- [x] Session Model com campos de iniciação/finalização
- [x] BotConfig Model com triggerKeyword e isActive
- [x] AutoResponse Model com ações dinâmicas
- [x] bot-agenda.service.js reescrito com novo fluxo
- [x] whatsapp.service.js integrado com novo fluxo
- [x] Verificação de syntax de todos os arquivos
- [x] Documentação completa
- [ ] Atualizar formulários do frontend
- [ ] Testar fluxo completo
- [ ] Deploy em produção

---

**Data de implementação:** 2025-12-19
**Versão:** 2.0
**Desenvolvido por:** Claude Code
