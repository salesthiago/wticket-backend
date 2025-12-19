# 🔒 Guia de Configuração SSL - Backend

Este guia explica como configurar HTTPS com Let's Encrypt para o domínio `api-wticket.godprovider.com.br`.

---

## ✅ PRÉ-REQUISITOS

Antes de começar, verifique:

- [x] Domínio `api-wticket.godprovider.com.br` está apontando para o IP do EC2
- [x] Backend está rodando na porta 3000 (PM2)
- [x] Security Group permite porta 80 (HTTP) e 443 (HTTPS)
- [x] Você tem acesso SSH ao EC2

---

## 🔍 PASSO 1: Verificar DNS

### 1.1 Verificar se o domínio está apontando corretamente

No seu **computador local**:

```bash
# Verificar o IP do domínio
nslookup api-wticket.godprovider.com.br

# Ou use dig
dig +short api-wticket.godprovider.com.br
```

Deve retornar o **IP público do seu EC2**.

### 1.2 Verificar IP do EC2

No **EC2**:

```bash
curl http://checkip.amazonaws.com
```

**IMPORTANTE:** O IP do domínio DEVE ser igual ao IP do EC2!

---

## 🔧 PASSO 2: Configurar Security Group

No **Console da AWS**:

1. Acesse **EC2** → **Security Groups**
2. Selecione o Security Group do seu EC2
3. Edite **Inbound rules** e certifique-se que tem:

| Tipo | Protocolo | Porta | Origem | Descrição |
|------|-----------|-------|--------|-----------|
| SSH | TCP | 22 | Seu IP | SSH |
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP (necessário para Let's Encrypt) |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS |
| Custom TCP | TCP | 3000 | 127.0.0.1/32 | Backend (apenas localhost) |

**Nota:** Depois de configurar Nginx, a porta 3000 só precisa aceitar conexões locais.

---

## 🚀 PASSO 3: Executar Script de Configuração SSL

### 3.1 Copiar script para o EC2

No seu **WSL/terminal local**:

```bash
cd /mnt/c/Users/sales  # ou onde estiver
cd wticket/backend

# Copiar script para EC2
scp -i ../Thiago.pem setup-ssl.sh ec2-user@ec2-18-231-190-91.sa-east-1.compute.amazonaws.com:~/
```

### 3.2 Executar o script no EC2

No **EC2**:

```bash
# Dar permissão de execução
chmod +x setup-ssl.sh

# Executar como root
sudo ./setup-ssl.sh
```

O script irá:
1. ✅ Instalar Nginx
2. ✅ Instalar Certbot
3. ✅ Configurar Nginx como proxy reverso
4. ✅ Gerar certificado SSL
5. ✅ Configurar renovação automática
6. ✅ Aplicar configurações de segurança

### 3.3 Acompanhar execução

O script mostrará o progresso. Se tudo der certo, você verá:

```
✅ CONFIGURAÇÃO SSL COMPLETA!
🌐 Seu backend está acessível em:
   https://api-wticket.godprovider.com.br
```

---

## 🧪 PASSO 4: Testar a Configuração

### 4.1 Testar HTTP → HTTPS Redirect

```bash
curl -I http://api-wticket.godprovider.com.br

# Deve retornar:
# HTTP/1.1 301 Moved Permanently
# Location: https://api-wticket.godprovider.com.br/
```

### 4.2 Testar HTTPS

```bash
curl https://api-wticket.godprovider.com.br

# Deve retornar resposta do backend
```

### 4.3 Testar no navegador

Acesse: https://api-wticket.godprovider.com.br

Você deve ver:
- ✅ Cadeado verde/seguro no navegador
- ✅ Certificado válido emitido por "Let's Encrypt"

### 4.4 Verificar certificado SSL

```bash
# No EC2
sudo certbot certificates

# Deve mostrar:
# Certificate Name: api-wticket.godprovider.com.br
# Expiry Date: ...
```

---

## ⚙️ PASSO 5: Atualizar Variáveis de Ambiente

### 5.1 No EC2 - Atualizar .env do backend

No **EC2**:

```bash
cd ~/wticket-deploy/backend

# Editar .env
nano .env
```

Atualize a URL do frontend (se já tiver configurado):

```bash
FRONTEND_URL=https://seu-dominio-frontend.com.br
```

Reinicie o backend:

```bash
pm2 restart wticket-backend
```

### 5.2 No GitHub - Atualizar Secrets

Acesse: https://github.com/salesthiago/wticket-backend/settings/secrets/actions

Atualize o secret:
- **Nome:** `FRONTEND_URL`
- **Valor:** `https://seu-dominio-frontend.com.br` (quando tiver)

---

## 🔄 PASSO 6: Configurar CORS no Backend

Se ainda não configurou CORS, adicione no seu backend:

```javascript
// src/server.js ou onde configura o Express
import cors from 'cors';

const app = express();

app.use(cors({
  origin: [
    'https://api-wticket.godprovider.com.br',
    'https://seu-dominio-frontend.com.br'  // quando tiver frontend
  ],
  credentials: true
}));
```

---

## 🔧 COMANDOS ÚTEIS

### Nginx

```bash
# Ver status
sudo systemctl status nginx

# Reiniciar
sudo systemctl restart nginx

# Recarregar (sem downtime)
sudo systemctl reload nginx

# Testar configuração
sudo nginx -t

# Ver logs de erro
sudo tail -f /var/log/nginx/api-wticket-error.log

# Ver logs de acesso
sudo tail -f /var/log/nginx/api-wticket-access.log
```

### Certbot (SSL)

```bash
# Ver certificados instalados
sudo certbot certificates

# Renovar manualmente
sudo certbot renew

# Testar renovação (dry-run)
sudo certbot renew --dry-run

# Revogar certificado
sudo certbot revoke --cert-name api-wticket.godprovider.com.br
```

### PM2 (Backend)

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs wticket-backend

# Reiniciar
pm2 restart wticket-backend
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Connection refused"

```bash
# Verificar se o backend está rodando
pm2 status

# Verificar se Nginx está rodando
sudo systemctl status nginx

# Verificar porta 3000
sudo netstat -tlnp | grep 3000
```

### Erro: "502 Bad Gateway"

```bash
# Backend provavelmente não está rodando
pm2 logs wticket-backend

# Ou Nginx não consegue conectar na porta 3000
sudo nginx -t
```

### Certificado SSL não foi gerado

```bash
# Verificar se domínio está apontando corretamente
dig +short api-wticket.godprovider.com.br

# Verificar se porta 80 está aberta
sudo netstat -tlnp | grep :80

# Tentar novamente manualmente
sudo certbot --nginx -d api-wticket.godprovider.com.br
```

### Nginx não inicia

```bash
# Ver erro
sudo nginx -t

# Ver logs
sudo journalctl -u nginx -n 50
```

---

## 📅 RENOVAÇÃO AUTOMÁTICA DO CERTIFICADO

O certificado Let's Encrypt é válido por **90 dias**.

✅ **Renovação automática está configurada!**

- Cron job roda diariamente às 3h da manhã
- Certbot renova automaticamente se faltar menos de 30 dias
- Nginx é recarregado automaticamente após renovação

Para verificar:

```bash
# Ver cron jobs
sudo crontab -l

# Testar renovação
sudo certbot renew --dry-run
```

---

## 🎉 PRÓXIMOS PASSOS

Agora que o backend está com HTTPS:

1. ✅ Configure o domínio do frontend
2. ✅ Configure SSL no frontend também
3. ✅ Atualize as URLs no código (frontend → backend)
4. ✅ Configure CORS corretamente
5. ✅ Teste a integração completa

---

## 📚 REFERÊNCIAS

- Certbot: https://certbot.eff.org/
- Let's Encrypt: https://letsencrypt.org/
- Nginx: https://nginx.org/en/docs/
- SSL Labs (testar SSL): https://www.ssllabs.com/ssltest/

---

## ✅ CHECKLIST DE VERIFICAÇÃO

- [ ] Domínio aponta para o IP correto
- [ ] Security Group permite portas 80 e 443
- [ ] Script setup-ssl.sh executado com sucesso
- [ ] Nginx está rodando
- [ ] Certificado SSL foi gerado
- [ ] HTTPS funciona no navegador
- [ ] HTTP redireciona para HTTPS
- [ ] Backend responde via HTTPS
- [ ] Renovação automática configurada
- [ ] Logs do Nginx não mostram erros
