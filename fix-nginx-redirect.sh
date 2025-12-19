#!/bin/bash

##############################################
# Script de Diagnóstico e Correção Nginx
# Resolve redirecionamento indevido
##############################################

set -e

DOMAIN="api-wticket.godprovider.com.br"

echo "🔍 Diagnosticando problema do Nginx..."
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
   echo "⚠️  Por favor, execute este script como root (use sudo)"
   exit 1
fi

echo "📋 1. Verificando configurações do Nginx..."
echo ""

# Listar todas as configurações ativas
echo "Arquivos de configuração encontrados:"
ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "Nenhum arquivo em conf.d"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "Nenhum arquivo em sites-enabled"
echo ""

# Verificar nginx.conf principal
echo "📄 2. Verificando nginx.conf principal..."
grep -n "server_name" /etc/nginx/nginx.conf 2>/dev/null || echo "Nenhum server_name em nginx.conf (OK)"
echo ""

# Verificar se existe configuração padrão que pode estar causando conflito
echo "📄 3. Verificando configuração padrão..."
if [ -f "/etc/nginx/conf.d/default.conf" ]; then
    echo "⚠️  PROBLEMA ENCONTRADO: default.conf existe e pode estar causando conflito"
    echo "Conteúdo do default.conf:"
    cat /etc/nginx/conf.d/default.conf
    echo ""
fi

if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "⚠️  PROBLEMA ENCONTRADO: sites-enabled/default existe"
    echo ""
fi

echo "🔧 4. Removendo configurações conflitantes..."

# Remover default.conf se existir
if [ -f "/etc/nginx/conf.d/default.conf" ]; then
    echo "Removendo /etc/nginx/conf.d/default.conf..."
    mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.backup
    echo "✅ Movido para default.conf.backup"
fi

# Remover configuração padrão do sites-enabled
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "Removendo /etc/nginx/sites-enabled/default..."
    rm -f /etc/nginx/sites-enabled/default
    echo "✅ Removido"
fi

echo ""
echo "🔧 5. Recriando configuração do domínio..."

# Criar/recriar a configuração correta
cat > /etc/nginx/conf.d/api-wticket.conf << 'EOF'
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api-wticket.godprovider.com.br;

    # Redirecionar tudo para HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api-wticket.godprovider.com.br;

    # Certificados SSL (gerados pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/api-wticket.godprovider.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-wticket.godprovider.com.br/privkey.pem;

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

    # Tamanho máximo de upload
    client_max_body_size 100M;

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

echo "✅ Configuração criada"
echo ""

echo "🧪 6. Testando configuração do Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida!"
else
    echo "❌ Erro na configuração. Verifique os logs acima."
    exit 1
fi

echo ""
echo "🔄 7. Recarregando Nginx..."
systemctl reload nginx

echo ""
echo "✅ 8. Verificando status do Nginx..."
systemctl status nginx --no-pager | head -n 10

echo ""
echo "=============================================="
echo "✅ CORREÇÃO APLICADA!"
echo "=============================================="
echo ""
echo "🧪 Testando o acesso..."
echo ""

# Testar HTTP (deve redirecionar para HTTPS)
echo "📡 Teste 1: HTTP (porta 80)"
curl -I -L http://$DOMAIN 2>&1 | grep -E "HTTP|Location" | head -n 5
echo ""

# Testar HTTPS
echo "📡 Teste 2: HTTPS (porta 443)"
curl -I -k https://$DOMAIN 2>&1 | grep -E "HTTP|Server" | head -n 5
echo ""

echo "=============================================="
echo "📋 PRÓXIMOS PASSOS:"
echo "=============================================="
echo ""
echo "1. Acesse no navegador: https://$DOMAIN"
echo "   Você NÃO deve ser redirecionado para o IP da EC2"
echo ""
echo "2. Se ainda houver problemas:"
echo "   - Limpe o cache do navegador (Ctrl+Shift+Del)"
echo "   - Teste em modo anônimo/privado"
echo "   - Aguarde alguns minutos para propagação DNS"
echo ""
echo "3. Verificar logs de erro:"
echo "   tail -f /var/log/nginx/api-wticket-error.log"
echo ""
echo "4. Verificar se o backend está rodando:"
echo "   curl http://localhost:3000"
echo ""
echo "=============================================="
