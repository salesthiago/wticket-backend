#!/bin/bash

##############################################
# Script de Verificação do Backend
##############################################

echo "🔍 Verificando status do Backend..."
echo ""

DOMAIN="api.wticket.com.br"

echo "=============================================="
echo "1️⃣ VERIFICAÇÃO DO SERVIÇO NODE.JS"
echo "=============================================="
echo ""

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 não está instalado"
    echo "   Instale com: npm install -g pm2"
else
    echo "✅ PM2 está instalado"
    echo ""
    echo "📋 Processos PM2:"
    pm2 list
    echo ""
    echo "📊 Status detalhado:"
    pm2 show backend 2>/dev/null || echo "⚠️  Processo 'backend' não encontrado no PM2"
fi

echo ""
echo "=============================================="
echo "2️⃣ VERIFICAÇÃO DA PORTA 3000"
echo "=============================================="
echo ""

# Verificar se algo está escutando na porta 3000
if lsof -i :3000 &> /dev/null || netstat -tuln | grep :3000 &> /dev/null; then
    echo "✅ Porta 3000 está em uso (OK)"
    echo ""
    echo "Processo usando a porta:"
    lsof -i :3000 2>/dev/null || netstat -tuln | grep :3000
else
    echo "❌ Nada está escutando na porta 3000"
    echo "   O backend não está rodando!"
fi

echo ""
echo "=============================================="
echo "3️⃣ TESTE DE CONECTIVIDADE LOCAL"
echo "=============================================="
echo ""

# Testar acesso local
echo "📡 Testando http://localhost:3000..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)

if [ "$RESPONSE" != "000" ]; then
    echo "✅ Backend respondeu com código: $RESPONSE"
    echo ""
    echo "Resposta do backend:"
    curl -s http://localhost:3000 | head -n 10
else
    echo "❌ Backend não está respondendo localmente"
    echo "   Verifique se o serviço está rodando"
fi

echo ""
echo "=============================================="
echo "4️⃣ VERIFICAÇÃO DO NGINX"
echo "=============================================="
echo ""

# Status do Nginx
echo "📋 Status do Nginx:"
systemctl is-active nginx && echo "✅ Nginx está ativo" || echo "❌ Nginx não está ativo"

echo ""
echo "📄 Configurações do Nginx:"
ls -lh /etc/nginx/conf.d/*.conf 2>/dev/null || echo "Nenhum arquivo de configuração encontrado"

echo ""
echo "🧪 Teste de configuração do Nginx:"
nginx -t 2>&1 | grep -E "successful|failed"

echo ""
echo "=============================================="
echo "5️⃣ TESTE DE ACESSO EXTERNO"
echo "=============================================="
echo ""

# Testar HTTP
echo "📡 Testando HTTP (porta 80):"
curl -I -L http://$DOMAIN 2>&1 | grep -E "HTTP|Location|Server" | head -n 5

echo ""

# Testar HTTPS
echo "📡 Testando HTTPS (porta 443):"
curl -I -k https://$DOMAIN 2>&1 | grep -E "HTTP|Location|Server" | head -n 5

echo ""
echo "=============================================="
echo "6️⃣ VERIFICAÇÃO DE DNS"
echo "=============================================="
echo ""

DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)
SERVER_IP=$(curl -s http://checkip.amazonaws.com)

echo "IP do domínio $DOMAIN: $DOMAIN_IP"
echo "IP deste servidor: $SERVER_IP"

if [ "$DOMAIN_IP" == "$SERVER_IP" ]; then
    echo "✅ DNS configurado corretamente"
else
    echo "⚠️  DNS pode estar configurado incorretamente"
fi

echo ""
echo "=============================================="
echo "7️⃣ LOGS RECENTES"
echo "=============================================="
echo ""

echo "📄 Últimas 10 linhas do log de erro do Nginx:"
tail -n 10 /var/log/nginx/api-wticket-error.log 2>/dev/null || echo "Nenhum log encontrado"

echo ""
echo "📄 Últimas 10 linhas do log do PM2:"
pm2 logs backend --lines 10 --nostream 2>/dev/null || echo "Logs do PM2 não disponíveis"

echo ""
echo "=============================================="
echo "📋 RESUMO E AÇÕES"
echo "=============================================="
echo ""

# Verificar problemas comuns
ISSUES=0

if ! systemctl is-active nginx &> /dev/null; then
    echo "❌ Nginx não está rodando"
    echo "   Solução: sudo systemctl start nginx"
    ISSUES=$((ISSUES+1))
fi

if ! lsof -i :3000 &> /dev/null && ! netstat -tuln | grep :3000 &> /dev/null; then
    echo "❌ Backend não está rodando na porta 3000"
    echo "   Solução: cd ~/wticket/backend && pm2 start ecosystem.config.js"
    ISSUES=$((ISSUES+1))
fi

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo "⚠️  DNS pode estar incorreto"
    echo "   Verifique as configurações do seu provedor de domínio"
    ISSUES=$((ISSUES+1))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ Tudo parece estar funcionando corretamente!"
    echo ""
    echo "Se ainda houver redirecionamento:"
    echo "1. Limpe o cache do navegador"
    echo "2. Teste em modo anônimo"
    echo "3. Execute: sudo bash fix-nginx-redirect.sh"
else
    echo ""
    echo "Total de problemas encontrados: $ISSUES"
fi

echo ""
