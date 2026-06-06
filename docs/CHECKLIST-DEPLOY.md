# ✅ Checklist de Deploy - Backend

Use este checklist para garantir que tudo está configurado corretamente.

---

## 📋 NO EC2

- [ ] Conectado no EC2 via SSH
- [ ] Script `setup-ec2.sh` executado com sucesso
- [ ] Chave SSH privada copiada (para usar no GitHub)
- [ ] Node.js instalado (verificar: `node --version`)
- [ ] PM2 instalado (verificar: `pm2 --version`)
- [ ] MongoDB rodando (verificar: `sudo systemctl status mongod`)
- [ ] Diretório `~/wticket-deploy` criado

---

## 🔐 NO GITHUB

### Token do GitHub
- [ ] Token criado com permissões `repo` e `workflow`
- [ ] Token copiado e salvo temporariamente
- [ ] Arquivo `.git/config` atualizado com o token

### Secrets Configurados
Acesse: https://github.com/salesthiago/wticket-backend/settings/secrets/actions

- [ ] `EC2_SSH_PRIVATE_KEY` - Chave SSH completa do EC2
- [ ] `EC2_HOST` - IP ou DNS do EC2 (ex: `18.231.190.91`)
- [ ] `EC2_USER` - Usuario do EC2 (`ec2-user`)
- [ ] `MONGO_URI` - URI do MongoDB (`mongodb://localhost:27017/wticket`)
- [ ] `JWT_SECRET` - Token secreto (32+ caracteres)
- [ ] `FRONTEND_URL` - URL do frontend (ex: `http://18.231.190.91`)

---

## 🔒 NO AWS CONSOLE

- [ ] Security Group permite porta **22** (SSH)
- [ ] Security Group permite porta **3000** (Backend API)
- [ ] Security Group permite porta **80** (HTTP para frontend)

---

## 📦 NO REPOSITÓRIO LOCAL

- [ ] Arquivo `.github/workflows/deploy-backend.yml` criado
- [ ] Arquivo `ecosystem.config.js` criado
- [ ] Arquivo `setup-ec2.sh` criado
- [ ] Arquivos adicionados ao git (`git add`)
- [ ] Commit criado (`git commit`)
- [ ] Push realizado (`git push origin development`)

---

## 🧪 TESTE

- [ ] GitHub Actions rodou com sucesso
- [ ] PM2 mostra aplicação rodando no EC2 (`pm2 status`)
- [ ] API responde: `curl http://SEU_IP:3000`
- [ ] Logs não mostram erros: `pm2 logs wticket-backend`

---

## 📝 COMANDOS DE VERIFICAÇÃO

```bash
# No EC2 - Verificar se tudo está rodando
pm2 status
sudo systemctl status mongod
curl http://localhost:3000

# Local - Verificar configuração do git
git remote -v
git config user.name
git config user.email

# Local - Verificar secrets do GitHub (via navegador)
# https://github.com/salesthiago/wticket-backend/settings/secrets/actions
```

---

## ❌ SE ALGO DEU ERRADO

### Deploy falhou no GitHub Actions
1. Veja os logs: https://github.com/salesthiago/wticket-backend/actions
2. Verifique se todos os secrets estão corretos
3. Verifique se a chave SSH está completa (com BEGIN e END)

### Aplicação não inicia no EC2
```bash
# Ver logs detalhados
pm2 logs wticket-backend --lines 100

# Verificar .env
cat ~/wticket-deploy/backend/.env

# Restaurar backup
cd ~/wticket-deploy
mv backend backend-failed
mv backend-backup backend
pm2 restart wticket-backend
```

### Não consigo fazer push
```bash
# Verificar se o token tem permissão 'workflow'
# Gerar novo token: https://github.com/settings/tokens

# Atualizar git config
cd E:\projetos\wticket\backend
git remote set-url origin https://salesthiago:NOVO_TOKEN@github.com/salesthiago/wticket-backend.git
```

---

## ✅ TUDO FUNCIONANDO?

Se todos os itens estão marcados e a aplicação está rodando, você está pronto! 🎉

Próximo passo: Configurar deploy do **Frontend**.
