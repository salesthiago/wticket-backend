#!/bin/bash

##############################################
# Script de Setup Inicial do EC2 para Backend
# Execute este script UMA VEZ no EC2
##############################################

set -e  # Parar em caso de erro

echo "🚀 Iniciando configuração do EC2 para WTicket Backend..."

# Atualizar sistema
echo "📦 Atualizando sistema..."
sudo yum update -y

# Instalar Node.js 18
echo "📥 Instalando Node.js 18..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verificar instalação
echo "✅ Node.js versão: $(node --version)"
echo "✅ NPM versão: $(npm --version)"

# Instalar PM2 globalmente
echo "📥 Instalando PM2..."
sudo npm install -g pm2

# Verificar PM2
echo "✅ PM2 versão: $(pm2 --version)"

# Instalar MongoDB
echo "📥 Instalando MongoDB..."
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF

sudo yum install -y mongodb-org

# Iniciar MongoDB
echo "🔄 Iniciando MongoDB..."
sudo systemctl start mongod
sudo systemctl enable mongod

echo "✅ MongoDB status:"
sudo systemctl status mongod --no-pager

# Instalar Git
echo "📥 Instalando Git..."
sudo yum install -y git

# Configurar Git
read -p "Digite seu nome para o Git: " git_name
read -p "Digite seu email para o Git: " git_email
git config --global user.name "$git_name"
git config --global user.email "$git_email"

# Criar diretório de deploy
echo "📂 Criando diretório de deploy..."
mkdir -p ~/wticket-deploy

# Gerar chave SSH para GitHub Actions
echo "🔑 Gerando chave SSH para GitHub Actions..."
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Adicionar chave pública ao authorized_keys
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

echo ""
echo "=============================================="
echo "✅ SETUP COMPLETO!"
echo "=============================================="
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. Copie a CHAVE PRIVADA abaixo e adicione no GitHub Secrets como 'EC2_SSH_PRIVATE_KEY':"
echo ""
echo "========== INÍCIO DA CHAVE =========="
cat ~/.ssh/github_actions_deploy
echo "=========== FIM DA CHAVE ==========="
echo ""
echo "2. Adicione os seguintes secrets no GitHub:"
echo "   - EC2_SSH_PRIVATE_KEY: (chave acima)"
echo "   - EC2_HOST: $(curl -s http://checkip.amazonaws.com)"
echo "   - EC2_USER: $(whoami)"
echo "   - MONGO_URI: mongodb://localhost:27017/wticket"
echo "   - JWT_SECRET: (gere um token seguro)"
echo "   - FRONTEND_URL: http://$(curl -s http://checkip.amazonaws.com)"
echo ""
echo "3. Certifique-se de que o Security Group permite:"
echo "   - Porta 22 (SSH)"
echo "   - Porta 3000 (Backend API)"
echo "   - Porta 80 (HTTP - para frontend)"
echo ""
echo "4. Faça push do código para o GitHub e o deploy será automático!"
echo ""
echo "=============================================="
