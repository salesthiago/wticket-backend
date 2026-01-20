#!/bin/bash

##############################################
# Script de Setup Inicial do EC2 para Backend
# Execute este script UMA VEZ no EC2
##############################################

set -e  # Parar em caso de erro

echo "🚀 Iniciando configuração do EC2 para WTicket Backend..."

# Detectar versão do Amazon Linux
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_VERSION=$VERSION_ID
    echo "📋 Detectado: $NAME $VERSION_ID"
else
    OS_VERSION="2"
    echo "📋 Não foi possível detectar versão, assumindo Amazon Linux 2"
fi

# Atualizar sistema
echo "📦 Atualizando sistema..."
if [[ "$OS_VERSION" == "2023" ]]; then
    sudo dnf update -y
else
    sudo yum update -y
fi

##############################################
# Instalar dependências do Chrome/Puppeteer
# Necessário para o WPPConnect funcionar
##############################################
echo "📥 Instalando dependências do Chrome/Puppeteer..."

if [[ "$OS_VERSION" == "2023" ]]; then
    # Amazon Linux 2023 - usar dnf
    sudo dnf install -y \
        nss \
        atk \
        at-spi2-atk \
        cups-libs \
        libdrm \
        libXcomposite \
        libXdamage \
        libXrandr \
        mesa-libgbm \
        pango \
        alsa-lib \
        libxkbcommon \
        libX11 \
        libXext \
        libXfixes \
        libXcursor \
        libXi \
        libXrender \
        libXtst \
        libXScrnSaver \
        dbus-libs \
        expat \
        fontconfig \
        freetype \
        glib2 \
        nspr \
        cairo \
        gtk3 \
        wget \
        unzip

    # Instalar Google Chrome no Amazon Linux 2023
    echo "📥 Instalando Google Chrome..."
    wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm -O /tmp/chrome.rpm
    sudo dnf install -y /tmp/chrome.rpm || {
        echo "⚠️ Falha ao instalar Chrome via RPM, tentando Chromium..."
        sudo dnf install -y chromium
    }
    rm -f /tmp/chrome.rpm
else
    # Amazon Linux 2 - usar yum
    sudo yum install -y \
        alsa-lib.x86_64 \
        atk.x86_64 \
        cups-libs.x86_64 \
        gtk3.x86_64 \
        ipa-gothic-fonts \
        libXcomposite.x86_64 \
        libXcursor.x86_64 \
        libXdamage.x86_64 \
        libXext.x86_64 \
        libXi.x86_64 \
        libXrandr.x86_64 \
        libXScrnSaver.x86_64 \
        libXtst.x86_64 \
        pango.x86_64 \
        xorg-x11-fonts-100dpi \
        xorg-x11-fonts-75dpi \
        xorg-x11-fonts-cyrillic \
        xorg-x11-fonts-misc \
        xorg-x11-fonts-Type1 \
        xorg-x11-utils \
        nss \
        libdrm \
        mesa-libgbm \
        libxkbcommon \
        wget \
        unzip

    # Tentar instalar Chrome no Amazon Linux 2
    echo "📥 Instalando Google Chrome..."
    wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm -O /tmp/chrome.rpm
    sudo yum install -y /tmp/chrome.rpm || {
        echo "⚠️ Chrome não disponível, instalando Chromium..."
        sudo amazon-linux-extras install -y epel
        sudo yum install -y chromium
    }
    rm -f /tmp/chrome.rpm
fi

# Verificar instalação do Chrome/Chromium
echo "🔍 Verificando instalação do Chrome/Chromium..."
CHROME_PATH=""
if command -v google-chrome &> /dev/null; then
    CHROME_PATH=$(which google-chrome)
    echo "✅ Google Chrome encontrado: $CHROME_PATH"
    google-chrome --version
elif command -v google-chrome-stable &> /dev/null; then
    CHROME_PATH=$(which google-chrome-stable)
    echo "✅ Google Chrome Stable encontrado: $CHROME_PATH"
    google-chrome-stable --version
elif command -v chromium-browser &> /dev/null; then
    CHROME_PATH=$(which chromium-browser)
    echo "✅ Chromium encontrado: $CHROME_PATH"
    chromium-browser --version
elif command -v chromium &> /dev/null; then
    CHROME_PATH=$(which chromium)
    echo "✅ Chromium encontrado: $CHROME_PATH"
    chromium --version
else
    echo "⚠️ AVISO: Nenhum navegador Chrome/Chromium encontrado!"
    echo "   O Puppeteer tentará baixar sua própria versão do Chrome."
fi

# Instalar Node.js 18
echo "📥 Instalando Node.js 18..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
if [[ "$OS_VERSION" == "2023" ]]; then
    sudo dnf install -y nodejs
else
    sudo yum install -y nodejs
fi

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
if [[ "$OS_VERSION" == "2023" ]]; then
    sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
    sudo dnf install -y mongodb-org
else
    sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
    sudo yum install -y mongodb-org
fi

# Iniciar MongoDB
echo "🔄 Iniciando MongoDB..."
sudo systemctl start mongod
sudo systemctl enable mongod

echo "✅ MongoDB status:"
sudo systemctl status mongod --no-pager

# Instalar Git
echo "📥 Instalando Git..."
if [[ "$OS_VERSION" == "2023" ]]; then
    sudo dnf install -y git
else
    sudo yum install -y git
fi

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

# Configurar variáveis de ambiente para o Puppeteer
echo "📝 Configurando variáveis de ambiente para Puppeteer..."
if [ -n "$CHROME_PATH" ]; then
    # Adicionar CHROME_PATH ao bashrc se Chrome foi encontrado
    if ! grep -q "PUPPETEER_EXECUTABLE_PATH" ~/.bashrc; then
        echo "export PUPPETEER_EXECUTABLE_PATH=$CHROME_PATH" >> ~/.bashrc
    fi
fi

# Criar diretório de cache do Puppeteer
echo "📂 Criando diretório de cache do Puppeteer..."
mkdir -p ~/.cache/puppeteer
chmod 755 ~/.cache/puppeteer

# Configurar swap se necessário (importante para Chrome headless)
echo "💾 Verificando e configurando swap..."
if [ ! -f /swapfile ]; then
    echo "   Criando arquivo de swap de 2GB..."
    sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile swap swap defaults 0 0" | sudo tee -a /etc/fstab
    echo "✅ Swap configurado"
else
    echo "✅ Swap já existe"
fi

echo ""
echo "=============================================="
echo "✅ SETUP COMPLETO!"
echo "=============================================="
echo ""
echo "📋 DEPENDÊNCIAS INSTALADAS:"
echo "   - Node.js $(node --version)"
echo "   - NPM $(npm --version)"
echo "   - PM2 $(pm2 --version)"
echo "   - MongoDB"
echo "   - Git $(git --version | cut -d' ' -f3)"
if [ -n "$CHROME_PATH" ]; then
    echo "   - Chrome/Chromium: $CHROME_PATH"
fi
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
if [ -n "$CHROME_PATH" ]; then
    echo "   - CHROME_PATH: $CHROME_PATH (opcional, para forçar uso do Chrome instalado)"
fi
echo ""
echo "3. Certifique-se de que o Security Group permite:"
echo "   - Porta 22 (SSH)"
echo "   - Porta 3000 (Backend API)"
echo "   - Porta 80 (HTTP - para frontend)"
echo ""
echo "4. Após clonar/fazer deploy do código, execute:"
echo "   cd ~/wticket-deploy/backend"
echo "   npm install"
echo "   npx puppeteer browsers install chrome"
echo ""
echo "5. Faça push do código para o GitHub e o deploy será automático!"
echo ""
echo "=============================================="
echo ""
echo "⚠️  IMPORTANTE: Se o erro de Chrome persistir após npm install, execute:"
echo "   npx puppeteer browsers install chrome"
echo ""
echo "=============================================="
