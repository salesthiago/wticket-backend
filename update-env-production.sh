#!/bin/bash

##############################################
# Script para Atualizar .env em Produção
##############################################

set -e

echo "🔧 Atualizando variáveis de ambiente para produção..."
echo ""

# Caminho do projeto
PROJECT_DIR="$HOME/wticket/backend"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Diretório do projeto não encontrado: $PROJECT_DIR"
    exit 1
fi

cd $PROJECT_DIR

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado. Criando..."
    touch .env
fi

echo "📄 Arquivo .env atual:"
cat .env
echo ""
echo "=============================================="
echo ""

# Função para atualizar ou adicionar variável
update_or_add_env() {
    local key=$1
    local value=$2

    if grep -q "^${key}=" .env; then
        # Atualizar existente
        sed -i "s|^${key}=.*|${key}=${value}|" .env
        echo "✅ Atualizado: ${key}=${value}"
    else
        # Adicionar novo
        echo "${key}=${value}" >> .env
        echo "✅ Adicionado: ${key}=${value}"
    fi
}

echo "🔧 Atualizando variáveis..."
echo ""

# Atualizar FRONTEND_URL para produção
update_or_add_env "FRONTEND_URL" "https://wticket.godprovider.com.br"

# Garantir que NODE_ENV está em production
update_or_add_env "NODE_ENV" "production"

# Manter PORT como 3000 (padrão)
if ! grep -q "^PORT=" .env; then
    update_or_add_env "PORT" "3000"
fi

echo ""
echo "=============================================="
echo ""
echo "📄 Novo arquivo .env:"
cat .env
echo ""
echo "=============================================="
echo ""

# Perguntar se quer reiniciar o backend
read -p "🔄 Deseja reiniciar o backend agora? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Reiniciando backend com PM2..."
    pm2 restart backend
    echo "✅ Backend reiniciado!"
    echo ""
    echo "📊 Status do PM2:"
    pm2 list
    echo ""
    echo "📋 Logs recentes:"
    pm2 logs backend --lines 20 --nostream
else
    echo "⚠️  LEMBRE-SE: Você precisa reiniciar o backend para aplicar as mudanças!"
    echo "   Execute: pm2 restart backend"
fi

echo ""
echo "=============================================="
echo "✅ VARIÁVEIS ATUALIZADAS!"
echo "=============================================="
echo ""
echo "🌐 Frontend URL: https://wticket.godprovider.com.br"
echo "🔧 Backend URL: https://api-wticket.godprovider.com.br"
echo ""
echo "🧪 Teste o CORS:"
echo "   Acesse https://wticket.godprovider.com.br e tente fazer login"
echo ""
