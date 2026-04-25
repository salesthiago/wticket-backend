#!/bin/bash

##############################################
# Script de Configuração SSL para Backend
# Domínio: api-wticket.godprovider.com.br
##############################################

set -e  # Parar em caso de erro

DOMAIN="api.wticket.com.br"
EMAIL="sales.go@gmail.com"  # Altere se necessário

echo "🔒 Iniciando configuração SSL para $DOMAIN..."

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
   echo "⚠️  Por favor, execute este script como root (use sudo)"
   exit 1
fi

# Atualizar sistema
echo "📦 Atualizando sistema..."
yum update -y

# Instalar Nginx (se ainda não estiver instalado)
echo "📥 Instalando Nginx..."
yum install -y nginx

# Parar Nginx temporariamente (para o Certbot usar a porta 80)
systemctl stop nginx

# Instalar Certbot
echo "📥 Instalando Certbot..."
yum install -y certbot python3-certbot-nginx

# Verificar se o domínio está apontando corretamente
echo "🔍 Verificando DNS do domínio $DOMAIN..."
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)
SERVER_IP=$(curl -s http://checkip.amazonaws.com)

echo "IP do domínio: $DOMAIN_IP"
echo "IP do servidor: $SERVER_IP"

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo "⚠️  ATENÇÃO: O domínio $DOMAIN não está apontando para este servidor!"
    echo "   Domínio aponta para: $DOMAIN_IP"
    echo "   Servidor está em: $SERVER_IP"
    echo ""
    read -p "Deseja continuar mesmo assim? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Abortado. Configure o DNS primeiro."
        exit 1
    fi
fi

# Configurar Nginx antes de gerar o certificado
echo "⚙️  Configurando Nginx..."
cat > /etc/nginx/conf.d/api-wticket.conf << 'EOF'
server {
    listen 80;
    server_name api.wticket.com.br;

    # Temporário: apenas para validação do Certbot
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (Socket.io)
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Testar configuração do Nginx
echo "🧪 Testando configuração do Nginx..."
nginx -t

# Iniciar Nginx
echo "🚀 Iniciando Nginx..."
systemctl start nginx
systemctl enable nginx

# Gerar certificado SSL com Certbot
echo "🔐 Gerando certificado SSL com Let's Encrypt..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# Verificar se o certificado foi gerado
if [ $? -eq 0 ]; then
    echo "✅ Certificado SSL gerado com sucesso!"
else
    echo "❌ Erro ao gerar certificado SSL"
    exit 1
fi

# Configurar renovação automática
echo "⏰ Configurando renovação automática do certificado..."

# Testar renovação
certbot renew --dry-run

# Adicionar ao cron (se ainda não estiver)
(crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

# Configuração final do Nginx com SSL
echo "⚙️  Aplicando configuração final do Nginx..."
cat > /etc/nginx/conf.d/api-wticket.conf << 'EOF'
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name api.wticket.com.br;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name api.wticket.com.br;

    # Certificados SSL (gerados pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/api.wticket.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.wticket.com.br/privkey.pem;

    # Configurações SSL recomendadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy para o backend Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket (Socket.io)
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Logs
    access_log /var/log/nginx/api-wticket-access.log;
    error_log /var/log/nginx/api-wticket-error.log;
}
EOF

# Testar configuração final
echo "🧪 Testando configuração final do Nginx..."
nginx -t

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
systemctl reload nginx

echo ""
echo "=============================================="
echo "✅ CONFIGURAÇÃO SSL COMPLETA!"
echo "=============================================="
echo ""
echo "🌐 Seu backend está acessível em:"
echo "   https://$DOMAIN"
echo ""
echo "🔒 Certificado SSL:"
echo "   Emissor: Let's Encrypt"
echo "   Válido por: 90 dias"
echo "   Renovação automática: Configurada (diariamente às 3h)"
echo ""
echo "📋 Próximos passos:"
echo "   1. Teste o acesso: https://$DOMAIN"
echo "   2. Atualize a variável FRONTEND_URL no .env do backend"
echo "   3. Atualize o secret FRONTEND_URL no GitHub"
echo "   4. Configure o CORS no backend para aceitar o domínio do frontend"
echo ""
echo "🔧 Comandos úteis:"
echo "   - Ver status do Nginx: systemctl status nginx"
echo "   - Ver logs do Nginx: tail -f /var/log/nginx/api-wticket-error.log"
echo "   - Testar renovação SSL: certbot renew --dry-run"
echo "   - Ver certificados: certbot certificates"
echo ""
echo "=============================================="
