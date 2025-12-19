# 📋 Sistema de Logs - WTicket Backend

## 🎯 Visão Geral

Este documento explica o sistema de logging implementado no backend do WTicket para diagnosticar problemas de conexão com WhatsApp usando wppconnect.

## 📁 Localização dos Logs

Os logs são salvos em dois arquivos na pasta `logs/`:

- **`logs/combined.log`** - Todos os logs (debug, info, warn, error)
- **`logs/error.log`** - Apenas erros

Além disso, os logs também são exibidos no console com cores para facilitar a leitura.

## 🔧 Configuração

### Níveis de Log

Configure o nível de log no arquivo `.env`:

```env
LOG_LEVEL=debug  # Mais detalhado (recomendado para troubleshooting)
# LOG_LEVEL=info   # Normal (produção)
# LOG_LEVEL=warn   # Apenas avisos e erros
# LOG_LEVEL=error  # Apenas erros
```

### Níveis Disponíveis

1. **debug** - Logs muito detalhados, incluindo cada passo do processo
2. **info** - Informações importantes sobre o fluxo da aplicação
3. **warn** - Avisos sobre situações que merecem atenção
4. **error** - Erros que precisam ser corrigidos

## 📊 Estrutura dos Logs

### Formato de Log

```
2025-12-19 14:30:45 [INFO]: [nome-da-sessao] 🚀 Mensagem do log
```

- **Timestamp** - Data e hora do evento
- **Nível** - INFO, DEBUG, WARN, ERROR
- **Sessão** - Nome da sessão WhatsApp (quando aplicável)
- **Emoji** - Ícone visual para facilitar identificação
- **Mensagem** - Descrição do evento

## 🔍 Troubleshooting - Conexão WhatsApp

### Cenário 1: Tela Carregando Infinitamente

**O que procurar nos logs:**

1. **Início da criação da sessão:**
   ```
   🚀 CRIANDO SESSÃO: nome-da-sessao
   📁 Diretório de tokens: ...
   ⏳ Iniciando create() do wppconnect...
   ```

2. **Progresso do wppconnect:**
   ```
   🔍 Status Find: ...
   ⏳ Carregando: 50% - Initializing...
   ```

3. **Avisos de timeout:**
   ```
   ⏰ AVISO: create() está demorando mais de 60 segundos!
   ```

**Possíveis causas:**

- ❌ **Nenhum QR Code recebido** - Problema na inicialização do navegador
- ❌ **Timeout após 60s** - Processo travado
- ❌ **Erro no create()** - Problema com wppconnect ou dependências

### Cenário 2: QR Code Não Aparece

**O que procurar nos logs:**

```
📱 QR CODE RECEBIDO (tentativa 1)
QR Code URL: ...
QR Code salvo no banco de dados
QR Code emitido via Socket.IO
```

**Se não aparecer essa mensagem:**
- Problema na geração do QR Code pelo wppconnect
- Possível erro no navegador headless (Chrome/Chromium)

**Se aparecer mas não exibir no frontend:**
- Problema de conexão Socket.IO
- Verificar se o cliente está na sala correta

### Cenário 3: Erro ao Conectar

**O que procurar nos logs:**

```
❌ ERRO CRÍTICO AO CRIAR SESSÃO
Tipo do erro: ...
Mensagem: ...
Stack trace: ...
```

**Tipos de erro comuns:**

1. **Erro de rede/browser:**
   - Chrome/Chromium não instalado
   - Falta de permissões
   - Porta em uso

2. **Erro de token:**
   - Pasta `tokens/` sem permissão de escrita
   - Token corrompido

### Cenário 4: Desconexão Inesperada

**O que procurar nos logs:**

```
🔄 MUDANÇA DE ESTADO: DISCONNECTED
⚠️ SESSÃO DESCONECTADA - Estado: DISCONNECTED
⏰ Agendando reconexão em 5 segundos...
🔄 Iniciando tentativa de reconexão...
```

**Causas comuns:**
- WhatsApp Web desconectado manualmente no celular
- Timeout de inatividade
- Conflito de sessão (outro dispositivo conectou)

### Cenário 5: Conflito de Sessão

**O que procurar nos logs:**

```
🔄 MUDANÇA DE ESTADO: CONFLICT
⚠️ Estado CONFLICT detectado - executando useHere()
✅ useHere() executado com sucesso
```

**O que significa:**
- Outra instância do WhatsApp Web está conectada
- Sistema tenta assumir a sessão com `useHere()`

## 📱 Fluxo Normal de Conexão

### 1. Inicialização do Servidor

```
🚀 INICIALIZANDO SESSÕES DO BANCO DE DADOS
📊 Encontradas X sessão(ões) no banco de dados
```

### 2. Criação da Sessão

```
🚀 CRIANDO SESSÃO: nome-da-sessao
📁 Diretório de tokens: ...
⏳ Iniciando create() do wppconnect...
✅ create() finalizado em XXXms
🎯 Registrando listener de mudança de estado
📨 Registrando listener de mensagens
✅ Todos os listeners registrados com sucesso
```

### 3. Aguardando QR Code

```
📱 QR CODE RECEBIDO (tentativa 1)
QR Code salvo no banco de dados
QR Code emitido via Socket.IO
```

### 4. Conexão Estabelecida

```
🔄 MUDANÇA DE ESTADO: CONNECTED
🎉 SESSÃO CONECTADA COM SUCESSO!
📱 Dispositivo conectado: { phone: '...', platform: '...' }
```

### 5. Sincronização de Mensagens

```
🔍 Sincronizando mensagens não lidas para a sessão: ...
📥 Encontradas X mensagens não lidas
✅ Sincronização de mensagens não lidas concluída
```

## 🛠️ Comandos Úteis

### Ver logs em tempo real (Windows PowerShell)

```powershell
# Ver todos os logs
Get-Content logs\combined.log -Wait -Tail 50

# Ver apenas erros
Get-Content logs\error.log -Wait -Tail 50
```

### Ver logs em tempo real (Linux/Mac)

```bash
# Ver todos os logs
tail -f logs/combined.log

# Ver apenas erros
tail -f logs/error.log
```

### Filtrar logs por sessão

```powershell
# Windows
Get-Content logs\combined.log | Select-String "nome-da-sessao"
```

```bash
# Linux/Mac
grep "nome-da-sessao" logs/combined.log
```

### Limpar logs antigos

```bash
rm logs/*.log
```

## 🐛 Debug Avançado

### Habilitar logs do Puppeteer

Para logs ainda mais detalhados do navegador headless, adicione ao `.env`:

```env
DEBUG=puppeteer:*
```

### Verificar Health Check

O sistema verifica automaticamente a saúde das conexões a cada 30 segundos:

```
Health Check iniciado
🔍 Verificando saúde das sessões...
```

## 📞 Suporte

Se o problema persistir após analisar os logs:

1. Copie os logs relevantes de `logs/error.log`
2. Inclua o timestamp do problema
3. Descreva o comportamento esperado vs observado
4. Abra uma issue no repositório

## 🔐 Segurança

**Atenção:** Os logs podem conter informações sensíveis:
- Números de telefone
- Nomes de contatos
- Mensagens (em alguns casos)

**Nunca compartilhe logs públicos sem antes sanitizar dados sensíveis!**

## 📝 Notas de Desenvolvimento

- Logs são rotacionados automaticamente (máximo 5 arquivos de 5MB cada)
- Pasta `logs/` é ignorada pelo git (`.gitignore`)
- Formato timestamp: `YYYY-MM-DD HH:mm:ss`
- Cores apenas no console (arquivos em texto puro)

---

**Última atualização:** 2025-12-19
