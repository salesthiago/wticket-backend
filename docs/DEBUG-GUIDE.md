# 🔍 Guia Rápido de Debug - Conexão WhatsApp

## 🚀 Como Iniciar o Debug

### 1. Configure o Nível de Log

Edite o arquivo `.env` e defina:

```env
LOG_LEVEL=debug
```

### 2. Reinicie o Servidor

```bash
# Parar o servidor atual (Ctrl+C)

# Iniciar novamente
npm start
# ou
node src/server.js
```

### 3. Monitore os Logs em Tempo Real

#### Windows PowerShell:
```powershell
# Ver todos os logs ao vivo
Get-Content logs\combined.log -Wait -Tail 50

# Ver apenas erros ao vivo
Get-Content logs\error.log -Wait -Tail 50

# Filtrar por uma sessão específica
Get-Content logs\combined.log -Wait | Select-String "nome-da-sessao"
```

#### Linux/Mac/Git Bash:
```bash
# Ver todos os logs ao vivo
tail -f logs/combined.log

# Ver apenas erros ao vivo
tail -f logs/error.log

# Filtrar por uma sessão específica
tail -f logs/combined.log | grep "nome-da-sessao"
```

## 📋 Checklist de Diagnóstico

Quando a tela ficar carregando infinitamente, siga esta checklist:

### ✅ Passo 1: Verificar se o Servidor Iniciou

Procure nos logs:
```
✅ SERVIDOR RODANDO NA PORTA 3000
```

**Se não aparecer:** Problema na inicialização do servidor (porta ocupada, MongoDB offline, etc.)

---

### ✅ Passo 2: Verificar Conexão com MongoDB

Procure nos logs:
```
MongoDB conectado com sucesso
```

**Se não aparecer:** MongoDB não está rodando ou URL de conexão incorreta

---

### ✅ Passo 3: Verificar Inicialização da Sessão

Procure nos logs:
```
🚀 CRIANDO SESSÃO: nome-da-sessao
📁 Diretório de tokens: ...
⏳ Iniciando create() do wppconnect...
```

**Se não aparecer:** A requisição do frontend não está chegando ao backend

---

### ✅ Passo 4: Verificar Progresso do WPPConnect

Procure nos logs:
```
🔍 Status Find: ...
⏳ Carregando: X% - ...
✅ create() finalizado em XXXms
```

**Se aparecer timeout:**
```
⏰ AVISO: create() está demorando mais de 60 segundos!
```

**Possíveis causas:**
- Chrome/Chromium não instalado
- Falta de permissões no sistema
- Problema com headless browser

---

### ✅ Passo 5: Verificar Geração do QR Code

Procure nos logs:
```
📱 QR CODE RECEBIDO (tentativa 1)
QR Code salvo no banco de dados
QR Code emitido via Socket.IO
```

**Se não aparecer:** WPPConnect não conseguiu gerar o QR Code

**Se aparecer mas não mostrar no frontend:**
- Verificar conexão Socket.IO
- Verificar se o cliente entrou na sala correta

---

### ✅ Passo 6: Verificar Mudanças de Estado

Procure nos logs:
```
🔄 MUDANÇA DE ESTADO: CONNECTED
🎉 SESSÃO CONECTADA COM SUCESSO!
```

**Estados possíveis:**
- `initializing` - Iniciando
- `CONFLICT` - Conflito com outra sessão
- `UNLAUNCHED` - Não lançado
- `CONNECTED` - Conectado ✅
- `DISCONNECTED` - Desconectado
- `TIMEOUT` - Tempo esgotado

---

## 🐛 Problemas Comuns e Soluções

### Problema 1: "Tela Carregando Infinitamente"

**Logs esperados:**
```
[nome-da-sessao] ⏳ Iniciando create() do wppconnect...
[nome-da-sessao] 🔍 Status Find: ...
```

**Se não aparecer nenhum log:**
1. Verificar se o frontend está fazendo a requisição
2. Verificar CORS no backend
3. Verificar autenticação Socket.IO

**Se aparecer apenas "Iniciando create()" mas não progride:**
1. Verificar se Chrome/Chromium está instalado:
   ```bash
   # Windows
   where chrome

   # Linux
   which google-chrome
   which chromium
   ```

2. Instalar dependências do Puppeteer:
   ```bash
   npm install
   ```

3. Verificar permissões da pasta `tokens/`:
   ```bash
   # Linux/Mac
   chmod -R 755 tokens/
   ```

---

### Problema 2: "QR Code Não Aparece"

**Verificar nos logs:**
```
📱 QR CODE RECEBIDO (tentativa X)
```

**Se aparecer mas não mostrar no frontend:**

1. Verificar conexão Socket.IO no console do navegador:
   ```javascript
   // No console do navegador
   console.log(socket.connected) // deve ser true
   ```

2. Verificar se entrou na sala:
   ```
   // Nos logs do backend
   join-session: nome-da-sessao
   ```

3. Verificar emissão do evento:
   ```
   QR Code emitido via Socket.IO
   ```

---

### Problema 3: "Erro ao Criar Sessão"

**Procurar nos logs:**
```
❌ ERRO CRÍTICO AO CRIAR SESSÃO
Tipo do erro: ...
Mensagem: ...
```

**Ações baseadas no tipo de erro:**

**a) "ENOENT: no such file or directory"**
- Criar manualmente a pasta tokens: `mkdir tokens`
- Verificar permissões de escrita

**b) "Browser closed unexpectedly"**
- Instalar dependências do sistema (Linux):
  ```bash
  sudo apt-get install -y \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libasound2 libxrandr2 libpangocairo-1.0-0
  ```

**c) "Timeout"**
- Aumentar timeout no código
- Verificar recursos do sistema (RAM, CPU)
- Verificar conexão com internet

---

### Problema 4: "Desconexão Frequente"

**Procurar nos logs:**
```
🔄 MUDANÇA DE ESTADO: DISCONNECTED
⚠️ SESSÃO DESCONECTADA
```

**Causas comuns:**
1. WhatsApp Web desconectado no celular
2. Timeout de inatividade
3. Conflito de sessão (outro dispositivo)
4. Problemas de rede

**Solução:**
- O sistema tenta reconectar automaticamente após 5 segundos
- Verificar logs de reconexão:
  ```
  🔄 Iniciando tentativa de reconexão...
  ```

---

## 📊 Análise de Performance

### Ver Tempo de Inicialização

Procure nos logs:
```
✅ create() finalizado em XXXms
```

**Tempos normais:**
- **Nova sessão (primeiro QR):** 5-15 segundos
- **Sessão existente (com token):** 3-8 segundos
- **Mais de 60 segundos:** Problema!

---

## 🔧 Comandos Úteis

### Limpar Tudo e Recomeçar

```bash
# Parar servidor (Ctrl+C)

# Limpar logs
rm -rf logs/*.log        # Linux/Mac
del logs\*.log           # Windows

# Limpar tokens (CUIDADO: vai desconectar todas as sessões)
rm -rf tokens/*          # Linux/Mac
rmdir /s /q tokens       # Windows
mkdir tokens             # Recriar pasta

# Limpar banco de dados (OPCIONAL)
# mongo wticket --eval "db.sessions.deleteMany({})"

# Reiniciar servidor
npm start
```

### Exportar Logs para Análise

```bash
# Últimas 100 linhas
tail -n 100 logs/combined.log > debug_export.txt

# Últimas 24 horas (requer jq)
cat logs/combined.log | grep "$(date +%Y-%m-%d)" > today_logs.txt
```

---

## 🆘 Quando Pedir Ajuda

Se seguir todos os passos acima e o problema persistir, colete estas informações:

1. **Logs relevantes** (últimas 50 linhas de `logs/error.log`)
2. **Versão do Node.js:** `node --version`
3. **Sistema Operacional:** Windows/Linux/Mac
4. **Comportamento observado** vs **comportamento esperado**
5. **Passos para reproduzir o problema**

---

## 📝 Logs de Exemplo

### Conexão com Sucesso ✅

```
2025-12-19 14:30:45 [INFO]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:30:45 [INFO]: 🚀 CRIANDO SESSÃO: minha-sessao
2025-12-19 14:30:45 [INFO]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:30:45 [DEBUG]: [minha-sessao] Atualizando status no banco de dados para 'initializing'
2025-12-19 14:30:45 [DEBUG]: [minha-sessao] Status atualizado no banco de dados com sucesso
2025-12-19 14:30:45 [INFO]: [minha-sessao] 📁 Diretório de tokens: E:\projetos\wticket\backend\tokens\minha-sessao
2025-12-19 14:30:45 [INFO]: [minha-sessao] ⏳ Iniciando create() do wppconnect...
2025-12-19 14:30:50 [INFO]: [minha-sessao] 📱 QR CODE RECEBIDO (tentativa 1)
2025-12-19 14:30:50 [DEBUG]: [minha-sessao] QR Code salvo no banco de dados
2025-12-19 14:30:50 [DEBUG]: [minha-sessao] QR Code emitido via Socket.IO
2025-12-19 14:30:55 [INFO]: [minha-sessao] ✅ create() finalizado em 10234ms
2025-12-19 14:30:55 [INFO]: [minha-sessao] 🎯 Registrando listener de mudança de estado
2025-12-19 14:31:05 [INFO]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:31:05 [INFO]: [minha-sessao] 🔄 MUDANÇA DE ESTADO: CONNECTED
2025-12-19 14:31:05 [INFO]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:31:05 [INFO]: [minha-sessao] 🎉 SESSÃO CONECTADA COM SUCESSO!
```

### Erro na Conexão ❌

```
2025-12-19 14:30:45 [INFO]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:30:45 [INFO]: 🚀 CRIANDO SESSÃO: minha-sessao
2025-12-19 14:30:45 [INFO]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:30:45 [INFO]: [minha-sessao] ⏳ Iniciando create() do wppconnect...
2025-12-19 14:31:45 [WARN]: [minha-sessao] ⏰ AVISO: create() está demorando mais de 60 segundos!
2025-12-19 14:31:45 [WARN]: [minha-sessao] Possível travamento no processo de inicialização
2025-12-19 14:32:00 [ERROR]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:32:00 [ERROR]: [minha-sessao] ❌ ERRO CRÍTICO AO CRIAR SESSÃO
2025-12-19 14:32:00 [ERROR]: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2025-12-19 14:32:00 [ERROR]: [minha-sessao] Tipo do erro: TimeoutError
2025-12-19 14:32:00 [ERROR]: [minha-sessao] Mensagem: Timeout waiting for WhatsApp Web
```

---

**Última atualização:** 2025-12-19
