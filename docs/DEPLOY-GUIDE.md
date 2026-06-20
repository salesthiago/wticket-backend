# 🚀 Guia de Deploy Automático - Backend WTicket

Este guia explica como configurar o deploy automático do backend usando GitHub Actions.

---

## 📋 PRÉ-REQUISITOS

- ✅ Conta AWS com EC2 rodando Amazon Linux 2023
- ✅ Par de chaves SSH (.pem) para acessar o EC2
- ✅ Repositório GitHub criado
- ✅ Token do GitHub com permissão `workflow`

---

## 🔧 PASSO 1: Configurar o EC2

### 1.1 Conectar no EC2

No seu **WSL/terminal local**:

```bash
ssh -i Thiago.pem ec2-user@ec2-18-231-190-91.sa-east-1.compute.amazonaws.com
```

### 1.2 Executar Script de Setup

No **EC2**, execute:

```bash
# Baixar o script de setup (ou copiar manualmente)
curl -o setup-ec2.sh https://raw.githubusercontent.com/salesthiago/wticket-backend/main/setup-ec2.sh

# Dar permissão de execução
chmod +x setup-ec2.sh

# Executar
./setup-ec2.sh
```

**OU** copie o arquivo manualmente:

```bash
# No seu WSL local
scp -i Thiago.pem backend/setup-ec2.sh ec2-user@ec2-18-231-190-91.sa-east-1.compute.amazonaws.com:~/

# No EC2
chmod +x setup-ec2.sh
./setup-ec2.sh
```

### 1.3 Copiar a Chave SSH

Ao final do script, você verá uma **CHAVE PRIVADA SSH**. **COPIE ELA COMPLETAMENTE!**

```
========== INÍCIO DA CHAVE ==========
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
=========== FIM DA CHAVE ===========
```

⚠️ **IMPORTANTE:** Copie desde `-----BEGIN` até `-----END` (inclusive)

---

## 🔐 PASSO 2: Gerar Token do GitHub com Permissão `workflow`

### 2.1 Criar o Token

1. Acesse: https://github.com/settings/tokens
2. Click em **"Generate new token"** → **"Generate new token (classic)"**
3. Nome do token: `wticket-backend-deploy`
4. Expiration: Escolha conforme sua preferência (recomendo 90 days)
5. Selecione os escopos:
   - ✅ **`repo`** (marque todas as sub-opções)
   - ✅ **`workflow`** ← **ESSENCIAL!**
6. Click em **"Generate token"**
7. **COPIE O TOKEN** (ele só aparece uma vez!)

### 2.2 Atualizar Token nos Arquivos Git

No **PowerShell/terminal local**:

```powershell
cd E:\projetos\wticket\backend

# Atualizar remote com o novo token
git remote set-url origin https://salesthiago:SEU_TOKEN_AQUI@github.com/salesthiago/wticket-backend.git
```

---

## 🔑 PASSO 3: Configurar Secrets no GitHub

### 3.1 Acessar Configurações de Secrets

1. Acesse: https://github.com/salesthiago/wticket-backend/settings/secrets/actions
2. Click em **"New repository secret"**

### 3.2 Adicionar os Secrets

Adicione os seguintes secrets **UM POR UM**:

#### Secret 1: `EC2_SSH_PRIVATE_KEY`
- **Nome:** `EC2_SSH_PRIVATE_KEY`
- **Valor:** Cole a chave SSH privada que você copiou no Passo 1.3
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...toda a chave...
  -----END OPENSSH PRIVATE KEY-----
  ```

#### Secret 2: `EC2_HOST`
- **Nome:** `EC2_HOST`
- **Valor:** `ec2-18-231-190-91.sa-east-1.compute.amazonaws.com`
  - OU use apenas o IP: `18.231.190.91`

#### Secret 3: `EC2_USER`
- **Nome:** `EC2_USER`
- **Valor:** `ec2-user`

#### Secret 4: `MONGO_URI`
- **Nome:** `MONGO_URI`
- **Valor:** `mongodb://localhost:27017/wticket`

#### Secret 5: `JWT_SECRET`
- **Nome:** `JWT_SECRET`
- **Valor:** Gere um token seguro:
  ```bash
  # No terminal (Linux/Mac/WSL)
  openssl rand -hex 32
  ```
  - OU use: `7726fcfe9ea4dcf2748faebceacc1d5c23ba85e76652c191a852e6244350a33a`

#### Secret 6: `FRONTEND_URL`
- **Nome:** `FRONTEND_URL`
- **Valor:** `http://ec2-18-231-190-91.sa-east-1.compute.amazonaws.com`
  - OU: `http://18.231.190.91`

---

## 🔒 PASSO 4: Configurar Security Group da AWS

No **Console da AWS**:

1. Acesse **EC2** → **Security Groups**
2. Selecione o Security Group do seu EC2
3. Edite **Inbound rules** e adicione:

| Tipo | Protocolo | Porta | Origem | Descrição |
|------|-----------|-------|--------|-----------|
| SSH | TCP | 22 | Seu IP ou 0.0.0.0/0 | SSH |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | Backend API |
| HTTP | TCP | 80 | 0.0.0.0/0 | Frontend |

---

## 📤 PASSO 5: Fazer Deploy

### 5.1 Adicionar Arquivos ao Git

No **PowerShell local**:

```powershell
cd E:\projetos\wticket\backend

# Adicionar arquivos
git add .github/workflows/deploy-backend.yml
git add ecosystem.config.js
git add setup-ec2.sh
git add DEPLOY-GUIDE.md

# Fazer commit
git commit -m "Add automated deployment with GitHub Actions"

# Fazer push
git push origin development
```

### 5.2 Acompanhar o Deploy

1. Acesse: https://github.com/salesthiago/wticket-backend/actions
2. Você verá o workflow **"Deploy Backend to EC2"** rodando
3. Click nele para ver os logs em tempo real

### 5.3 Verificar no EC2

No **EC2**, verifique se a aplicação está rodando:

```bash
# Ver status do PM2
pm2 status

# Ver logs da aplicação
pm2 logs wticket-backend

# Ver últimas 50 linhas
pm2 logs wticket-backend --lines 50
```

---

## ✅ PASSO 6: Testar a Aplicação

### 6.1 Testar API

```bash
# Substitua pelo seu IP/domínio
curl http://18.231.190.91:3000

# Ou no navegador
# http://18.231.190.91:3000
```

---

## 🔄 COMO FUNCIONA O DEPLOY AUTOMÁTICO

O GitHub Actions será **disparado automaticamente** quando:

1. ✅ Você fizer **push** na branch `main` ou `development`
2. ✅ Um **Pull Request** for **merged** na `main` ou `development`
3. ✅ Você **disparar manualmente** via interface do GitHub

### Fluxo do Deploy:

1. **Build**: GitHub Actions instala dependências em produção
2. **Package**: Cria um pacote `.tar.gz` com apenas arquivos necessários
3. **Transfer**: Envia o pacote para o EC2 via SSH
4. **Deploy**: Extrai, configura `.env`, e reinicia com PM2
5. **Health Check**: Verifica se a aplicação está respondendo

---

## 🛠️ COMANDOS ÚTEIS NO EC2

```bash
# Ver status do PM2
pm2 status

# Ver logs em tempo real
pm2 logs wticket-backend

# Reiniciar aplicação
pm2 restart wticket-backend

# Parar aplicação
pm2 stop wticket-backend

# Verificar MongoDB
sudo systemctl status mongod

# Restaurar backup (em caso de erro no deploy)
cd ~/wticket-deploy
rm -rf backend
mv backend-backup backend
pm2 restart wticket-backend
```

---

## 🐛 TROUBLESHOOTING

### Deploy falhou no GitHub Actions

1. Verifique os **logs** no GitHub Actions
2. Confirme que todos os **secrets** estão corretos
3. Verifique se a **chave SSH** está correta

### Aplicação não inicia no EC2

```bash
# Ver logs detalhados
pm2 logs wticket-backend --lines 100

# Verificar arquivo .env
cat ~/wticket-deploy/backend/.env

# Verificar MongoDB
sudo systemctl status mongod

# Tentar iniciar manualmente
cd ~/wticket-deploy/backend
node src/server.js
```

### Não consigo acessar a API

1. Verifique o **Security Group** (porta 3000 aberta)
2. Verifique se a aplicação está rodando: `pm2 status`
3. Teste localmente no EC2: `curl http://localhost:3000`

---

## 📚 REFERÊNCIAS

- GitHub Actions: https://docs.github.com/actions
- PM2 Documentation: https://pm2.keymetrics.io/docs/usage/quick-start/
- MongoDB: https://docs.mongodb.com/

---

## 🎉 Pronto!

Agora sempre que você fizer push no repositório, o backend será automaticamente deployed no EC2! 🚀
