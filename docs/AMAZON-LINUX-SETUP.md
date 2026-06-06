# 🚀 Guia de Setup - Amazon Linux (Produção)

## 📋 Visão Geral

Este guia detalha como configurar o WTicket Backend no Amazon Linux para produção, incluindo a instalação de dependências necessárias para o wppconnect funcionar corretamente.

---

## 🔧 Dependências do Sistema

O wppconnect usa o Puppeteer, que precisa do Chrome/Chromium headless. No Amazon Linux, você precisa instalar várias dependências.

### Amazon Linux 2

```bash
# Atualizar pacotes
sudo yum update -y

# Instalar dependências do Chrome/Chromium
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
    xorg-x11-utils

# Instalar bibliotecas adicionais
sudo yum install -y \
    nss \
    libatk-bridge-2.0-0 \
    libdrm \
    libgbm \
    libxkbcommon

# Verificar instalação
which chromium-browser || echo "Chromium não encontrado, instalando..."
```

### Amazon Linux 2023

```bash
# Atualizar pacotes
sudo dnf update -y

# Instalar Chrome (recomendado)
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo dnf install -y ./google-chrome-stable_current_x86_64.rpm
rm google-chrome-stable_current_x86_64.rpm

# OU instalar Chromium
sudo dnf install -y chromium

# Instalar dependências adicionais
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
    alsa-lib
```

---

## 📦 Instalação do Node.js e npm

```bash
# Instalar Node.js 18.x (LTS recomendado)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# OU usando nvm (recomendado para flexibilidade)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
nvm alias default 18

# Verificar instalação
node --version  # deve mostrar v18.x.x
npm --version   # deve mostrar 9.x.x ou superior
```

---

## 🗂️ Configuração do Projeto

### 1. Clone e Instalação

```bash
# Navegar para o diretório do projeto
cd /caminho/do/projeto/wticket/backend

# Instalar dependências
npm install

# Verificar se o Puppeteer foi instalado corretamente
ls -la node_modules/puppeteer/.local-chromium/
```

### 2. Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```bash
nano .env
```

Adicione/ajuste as seguintes variáveis:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/wticket
JWT_SECRET=sua-chave-secreta-aqui
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://seu-dominio.com
LOG_LEVEL=info  # Use 'debug' para troubleshooting

# OPCIONAL: Especificar caminho do Chrome/Chromium
# CHROME_PATH=/usr/bin/google-chrome
# CHROME_PATH=/usr/bin/chromium-browser

# Configuração de ambiente
NODE_ENV=production
```

### 3. Criar Diretórios Necessários

```bash
# Criar pasta de tokens
mkdir -p tokens
chmod 755 tokens

# Criar pasta de logs
mkdir -p logs
chmod 755 logs

# Verificar permissões
ls -la
```

---

## 🔒 Configuração de Segurança

### 1. Permissões de Usuário

**IMPORTANTE:** Não rode o Node.js como root em produção!

```bash
# Criar usuário específico para a aplicação
sudo useradd -m -s /bin/bash wticket
sudo usermod -aG wheel wticket  # Se precisar de sudo ocasional

# Transferir propriedade dos arquivos
sudo chown -R wticket:wticket /caminho/do/projeto/wticket

# Mudar para o usuário
su - wticket
```

### 2. Firewall

```bash
# Permitir porta 3000 (ou sua porta configurada)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# Verificar
sudo firewall-cmd --list-ports
```

---

## 🚀 Executando a Aplicação

### Desenvolvimento/Teste

```bash
# Rodar diretamente
npm start

# OU com logs detalhados
LOG_LEVEL=debug npm start
```

### Produção com PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start src/server.js --name wticket-backend

# Configurar PM2 para iniciar no boot
pm2 startup
pm2 save

# Monitorar
pm2 monit

# Ver logs
pm2 logs wticket-backend

# Reiniciar
pm2 restart wticket-backend

# Parar
pm2 stop wticket-backend
```

### Produção com systemd

Criar arquivo `/etc/systemd/system/wticket.service`:

```ini
[Unit]
Description=WTicket Backend
After=network.target mongodb.service

[Service]
Type=simple
User=wticket
WorkingDirectory=/caminho/do/projeto/wticket/backend
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=wticket-backend
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Ativar e iniciar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable wticket
sudo systemctl start wticket

# Verificar status
sudo systemctl status wticket

# Ver logs
sudo journalctl -u wticket -f
```

---

## 🐛 Troubleshooting Amazon Linux

### Problema 1: "Chrome/Chromium não encontrado"

**Erro:**
```
Error: Could not find Chrome (ver. 121.0.6167.85)
```

**Solução:**

```bash
# Opção 1: Especificar caminho no .env
CHROME_PATH=/usr/bin/google-chrome

# Opção 2: Reinstalar Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo dnf install -y ./google-chrome-stable_current_x86_64.rpm

# Opção 3: Usar Chromium do Puppeteer
# (Já incluído no node_modules após npm install)
```

### Problema 2: "libgbm.so.1: cannot open shared object file"

**Solução:**

```bash
# Amazon Linux 2
sudo yum install -y mesa-libgbm

# Amazon Linux 2023
sudo dnf install -y mesa-libgbm
```

### Problema 3: "libnss3.so: cannot open shared object file"

**Solução:**

```bash
# Amazon Linux 2
sudo yum install -y nss nss-util

# Amazon Linux 2023
sudo dnf install -y nss
```

### Problema 4: "Failed to launch chrome - ECONNREFUSED"

**Causa:** Falta de memória ou recursos do sistema.

**Solução:**

```bash
# Verificar memória disponível
free -h

# Verificar processos do Chrome
ps aux | grep chrome

# Matar processos órfãos
pkill -f chrome

# Aumentar swap (se necessário)
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Problema 5: "Navigation timeout of 30000 ms exceeded"

**Solução:**

O timeout já foi aumentado para 180 segundos no código. Se ainda ocorrer:

```bash
# Verificar conectividade com WhatsApp Web
curl -I https://web.whatsapp.com

# Verificar DNS
dig web.whatsapp.com

# Verificar firewall de saída
sudo iptables -L OUTPUT
```

### Problema 6: Browser travando com "--single-process"

Em alguns ambientes Amazon Linux, o `--single-process` pode causar problemas.

**Solução:** Editar `whatsapp.service.js` e remover `--single-process` da configuração Linux, ou adicionar ao `.env`:

```env
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
```

---

## 📊 Monitoramento em Produção

### Ver Logs em Tempo Real

```bash
# Com PM2
pm2 logs wticket-backend --lines 100

# Com systemd
sudo journalctl -u wticket -f

# Logs da aplicação
tail -f /caminho/do/projeto/wticket/backend/logs/combined.log
tail -f /caminho/do/projeto/wticket/backend/logs/error.log
```

### Monitorar Recursos

```bash
# Uso de CPU e memória
top
htop  # se instalado

# Uso de disco
df -h
du -sh /caminho/do/projeto/wticket/backend/tokens/*

# Processos do Chrome
ps aux | grep chrome | wc -l
```

### Limpar Recursos

```bash
# Limpar logs antigos (mais de 7 dias)
find logs/ -name "*.log" -mtime +7 -delete

# Limpar sessões antigas/corrompidas
# CUIDADO: Isso desconectará todas as sessões!
# rm -rf tokens/*

# Limpar cache do Chrome
rm -rf tokens/*/Default/Cache/*
```

---

## 🔐 Checklist de Segurança em Produção

- [ ] Aplicação NÃO roda como root
- [ ] `.env` com permissões 600
- [ ] Firewall configurado (apenas portas necessárias abertas)
- [ ] MongoDB com autenticação habilitada
- [ ] SSL/TLS configurado no nginx/Apache
- [ ] JWT_SECRET complexo e único
- [ ] Logs rotacionados e não acessíveis publicamente
- [ ] Pasta `tokens/` protegida (não acessível via web)
- [ ] CORS configurado corretamente
- [ ] Rate limiting implementado
- [ ] Backup regular da pasta `tokens/` e banco de dados

---

## 📈 Otimização de Performance

### 1. Nginx Reverse Proxy

```nginx
upstream wticket_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name seu-dominio.com;

    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://wticket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://wticket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Limite de Sessões Simultâneas

Para evitar sobrecarga, limite o número de sessões:

```javascript
// No início de whatsapp.service.js
const MAX_SESSIONS = 10; // Ajustar conforme recursos do servidor
```

### 3. Monitoramento com CloudWatch (AWS)

```bash
# Instalar CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm

# Configurar para monitorar logs
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

---

## 📞 Suporte e Mais Informações

- **Logs do sistema:** `sudo journalctl -xe`
- **Logs do Chrome:** Configurar `DEBUG=puppeteer:*` no `.env`
- **Status do wppconnect:** Verificar em `logs/combined.log`

### Versões Testadas

- ✅ Amazon Linux 2 (Kernel 4.14+)
- ✅ Amazon Linux 2023 (Kernel 6.1+)
- ✅ Node.js 18.x LTS
- ✅ wppconnect 1.37.5+

---

**Última atualização:** 2025-12-19
