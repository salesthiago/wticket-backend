# 🔧 GUIA: Corrigir Erro de CORS em Produção

## 📋 Problema
O backend está rejeitando requisições do frontend em produção porque o CORS está configurado apenas para `http://localhost:4200`.

**Erro no console:**
```
Access to XMLHttpRequest at 'https://api-wticket.godprovider.com.br/api/auth/login'
from origin 'https://wticket.godprovider.com.br' has been blocked by CORS policy
```

---

## ✅ Solução Aplicada

### 1. **Atualização do app.js**
O arquivo `src/app.js` foi modificado para aceitar múltiplas origens:
- ✅ `http://localhost:4200` (desenvolvimento)
- ✅ `https://wticket.godprovider.com.br` (produção)
- ✅ Qualquer URL na variável `FRONTEND_URL` do .env

### 2. **Script de atualização automática**
Criado script `update-env-production.sh` para configurar o .env automaticamente.

---

## 🚀 PASSOS PARA APLICAR A CORREÇÃO

### **OPÇÃO 1: Fazer Deploy Automático (Recomendado)**

1. **Fazer commit e push das alterações:**
   ```bash
   git add backend/src/app.js
   git commit -m "fix: configurar CORS para produção"
   git push origin main
   ```

2. **Aguardar o GitHub Actions fazer o deploy automaticamente**
   - Acesse: `https://github.com/seu-usuario/wticket/actions`
   - Acompanhe o deploy do backend

3. **Após o deploy, conectar no servidor e atualizar o .env:**
   ```bash
   ssh -i sua-chave.pem ec2-user@api-wticket.godprovider.com.br
   cd ~/wticket/backend

   # Atualizar .env
   bash update-env-production.sh
   ```

---

### **OPÇÃO 2: Atualização Manual (Mais Rápido)**

Se quiser corrigir imediatamente sem esperar o deploy:

1. **Conectar ao servidor EC2:**
   ```bash
   ssh -i sua-chave.pem ec2-user@api-wticket.godprovider.com.br
   ```

2. **Editar o arquivo .env:**
   ```bash
   cd ~/wticket/backend
   nano .env
   ```

3. **Adicionar/atualizar a linha:**
   ```env
   FRONTEND_URL=https://wticket.godprovider.com.br
   NODE_ENV=production
   PORT=3000
   ```
   - Salvar: `Ctrl+X`, depois `Y`, depois `Enter`

4. **Reiniciar o backend:**
   ```bash
   pm2 restart backend
   pm2 logs backend --lines 20
   ```

5. **Verificar se funcionou:**
   ```bash
   # Ver logs do PM2
   pm2 logs backend

   # Deve mostrar que o backend reiniciou sem erros
   ```

---

## 🧪 TESTAR A CORREÇÃO

1. **Abra o frontend em produção:**
   ```
   https://wticket.godprovider.com.br
   ```

2. **Tente fazer login**
   - Se funcionar: ✅ CORS corrigido!
   - Se ainda der erro: ⚠️ Veja seção de troubleshooting

3. **Verificar no console do navegador (F12):**
   - **Antes:** `blocked by CORS policy`
   - **Depois:** Requisição bem-sucedida (200 OK)

---

## 🐛 TROUBLESHOOTING

### **Problema 1: Ainda dá erro de CORS**

**Verificar o .env:**
```bash
cd ~/wticket/backend
cat .env | grep FRONTEND_URL
```

**Deve mostrar:**
```
FRONTEND_URL=https://wticket.godprovider.com.br
```

**Se não mostrar ou estiver errado:**
```bash
echo "FRONTEND_URL=https://wticket.godprovider.com.br" >> .env
pm2 restart backend
```

---

### **Problema 2: Backend não reiniciou**

```bash
# Ver status do PM2
pm2 list

# Se não estiver rodando:
pm2 start ecosystem.config.js

# Se der erro, ver logs:
pm2 logs backend --err --lines 50
```

---

### **Problema 3: Variável de ambiente não está sendo lida**

```bash
# Verificar se o PM2 está carregando o .env
pm2 describe backend | grep env

# Reiniciar com força:
pm2 delete backend
pm2 start ecosystem.config.js
pm2 save
```

---

### **Problema 4: CORS ainda bloqueado após correção**

**Possíveis causas:**
1. Cache do navegador → Limpe o cache (`Ctrl+Shift+Del`)
2. Service Worker → Desregistre no DevTools (Application → Service Workers)
3. Backend não reiniciou → `pm2 restart backend`

---

## 📊 VERIFICAÇÃO COMPLETA

Execute este comando no servidor para verificar tudo:

```bash
echo "=== Verificação do Backend ==="
echo ""
echo "1. Status do PM2:"
pm2 list
echo ""
echo "2. Variável FRONTEND_URL:"
cat ~/wticket/backend/.env | grep FRONTEND_URL
echo ""
echo "3. Backend está respondendo:"
curl -s http://localhost:3000/health
echo ""
echo "4. CORS Headers (deve incluir wticket.godprovider.com.br):"
curl -I -X OPTIONS https://api-wticket.godprovider.com.br/api/auth/login \
  -H "Origin: https://wticket.godprovider.com.br" \
  -H "Access-Control-Request-Method: POST"
```

**Saída esperada:**
```
Access-Control-Allow-Origin: https://wticket.godprovider.com.br
Access-Control-Allow-Credentials: true
```

---

## ✅ CHECKLIST FINAL

- [ ] Arquivo `app.js` atualizado com CORS dinâmico
- [ ] Variável `FRONTEND_URL` configurada no .env
- [ ] Backend reiniciado com PM2
- [ ] Frontend consegue fazer login sem erro de CORS
- [ ] Console do navegador não mostra erros

---

## 📝 CONFIGURAÇÃO FINAL DO .ENV

Seu arquivo `.env` deve conter no mínimo:

```env
# Produção
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://wticket.godprovider.com.br

# Banco de dados
MONGODB_URI=sua_uri_mongodb

# JWT
JWT_SECRET=sua_chave_secreta

# Outras configurações...
```

---

**Se tudo funcionar, parabéns! Seu sistema está funcionando em produção! 🎉**
