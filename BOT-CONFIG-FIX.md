# 🤖 Fix: Bot Config - Session ID Validation

## 🐛 Problema Identificado

Quando tentava vincular um bot a uma sessão na interface de bot-config, ocorria o seguinte erro:

```
Cast to ObjectId failed for value "local" (type string) at path "sessionId"
```

## 🔍 Causa Raiz

O modelo `BotConfig` espera que o campo `sessionId` seja um **ObjectId do MongoDB** (referência ao modelo `Session`), mas o frontend estava enviando o **nome da sessão** (como "local", "teste", etc.) em vez do ID.

### Estrutura dos Modelos

**Session Model:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"), // MongoDB ObjectId
  name: "local",                              // String (nome amigável)
  status: "connected",
  // ... outros campos
}
```

**BotConfig Model:**
```javascript
{
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,  // ❌ Esperava ObjectId
    ref: 'Session'                          // ✅ Mas recebia "local" (string)
  },
  // ... outros campos
}
```

## ✅ Solução Implementada

Modificamos o controller `bot-config.controller.js` para aceitar **tanto o nome da sessão quanto o ObjectId**:

### Lógica Implementada

1. **Detectar o tipo do valor recebido:**
   - Se for um ObjectId válido (24 caracteres hexadecimais) → usar diretamente
   - Se for uma string (nome da sessão) → buscar o ObjectId no banco

2. **Buscar sessão por nome:**
   ```javascript
   const session = await Session.findOne({ name: sessionId });
   if (!session) {
     return res.status(404).json({ message: `Sessão "${sessionId}" não encontrada` });
   }
   finalData.sessionId = session._id; // Converter para ObjectId
   ```

3. **Validação robusta:**
   - Regex para verificar formato de ObjectId: `/^[0-9a-fA-F]{24}$/`
   - Mensagem de erro amigável se a sessão não existir
   - Logs detalhados para debugging

## 📝 Arquivos Modificados

### `src/controller/bot-config.controller.js`

**Funções alteradas:**
- ✅ `create()` - Criar novo bot com validação de sessionId
- ✅ `update()` - Atualizar bot com validação de sessionId

**Novo import adicionado:**
```javascript
import Session from '../models/session.model.js';
```

## 🧪 Como Testar

### Cenário 1: Criar bot com nome de sessão
```bash
POST /api/bot-config
{
  "name": "Atendimento Bot",
  "enabled": true,
  "sessionId": "local"  // ✅ Agora aceita nome da sessão
}
```

**Resposta esperada:**
- ✅ Bot criado com `sessionId` convertido para ObjectId
- Logs: `[bot-config] Sessão encontrada: 507f1f77bcf86cd799439011`

### Cenário 2: Criar bot com ObjectId válido
```bash
POST /api/bot-config
{
  "name": "FAQ Bot",
  "enabled": true,
  "sessionId": "507f1f77bcf86cd799439011"  // ✅ Também aceita ObjectId
}
```

**Resposta esperada:**
- ✅ Bot criado diretamente (sem lookup)

### Cenário 3: Sessão inexistente
```bash
POST /api/bot-config
{
  "name": "Support Bot",
  "sessionId": "sessao-que-nao-existe"  // ❌ Sessão não existe
}
```

**Resposta esperada:**
- ❌ Status 404
- Mensagem: `Sessão "sessao-que-nao-existe" não encontrada`

## 📊 Logs de Debug

Com `LOG_LEVEL=debug`, você verá:

```
[DEBUG]: [bot-config] sessionId "local" não é ObjectId, buscando sessão por nome...
[DEBUG]: [bot-config] Sessão encontrada: 507f1f77bcf86cd799439011
```

## 🔐 Validações Implementadas

1. ✅ Verifica se sessionId é um ObjectId válido (regex)
2. ✅ Busca sessão por nome se não for ObjectId
3. ✅ Retorna erro 404 se sessão não existir
4. ✅ Logs detalhados para troubleshooting
5. ✅ Funciona tanto em `create` quanto em `update`

## 🚀 Deploy em Produção

Após este fix, você pode testar localmente e depois fazer deploy no AWS EC2:

```bash
# 1. Testar localmente
npm start

# 2. Testar criação de bot vinculado à sessão
# (usar a interface do frontend)

# 3. Se tudo funcionar, fazer deploy no AWS
# (seguir passos do AMAZON-LINUX-SETUP.md)
```

## 📌 Notas Importantes

- **Compatibilidade retroativa:** O código ainda aceita ObjectId direto (se o frontend for atualizado no futuro)
- **Segurança:** Validação de formato antes de fazer query no banco
- **Performance:** Apenas uma query extra se for nome de sessão (cache pode ser implementado depois)

---

**Data da correção:** 2025-12-19
**Testado em:** Windows 11 (desenvolvimento local)
**Próximo passo:** Deploy em AWS EC2 Amazon Linux
