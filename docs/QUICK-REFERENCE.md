# 📋 Quick Reference - Deploy VPS

## 🚀 Deploy Rápido (5 minutos)

### 1. Setup Inicial (apenas primeira vez)
```bash
# Na VPS como root
wget -O - https://raw.githubusercontent.com/kauameloo/promolinxy-saas-bot-whatsapp/main/deploy/setup-vps.sh | bash
```

### 2. Clone & Configure
```bash
cd /root/stack
git clone https://github.com/kauameloo/promolinxy-saas-bot-whatsapp.git temp
cp temp/docker-compose.yml .
cp temp/Caddyfile .
cp temp/.env.example .env
cp -r temp/scripts promolinxy-saas-bot-whatsapp/
rm -rf temp

# Edite o .env com suas configurações
nano .env
```

### 3. Deploy
```bash
cd /root/stack
docker compose pull
docker compose build
docker compose up -d
```

### 4. Verificar
```bash
docker compose ps
docker compose logs -f
```

---

## 🌐 URLs dos Serviços

| Serviço | URL | Porta Interna |
|---------|-----|---------------|
| Frontend | https://app.promolinxy.online | 3000 |
| Backend | https://backend.promolinxy.online | 3001 |
| Typebot Builder | https://builder.promolinxy.online | 3000 |
| Typebot Viewer | https://bot.promolinxy.online | 3000 |
| N8N | https://n8n.promolinxy.online | 5678 |

---

## 🔧 Comandos Essenciais

```bash
# Ver status
docker compose ps

# Ver logs
docker compose logs -f [service]

# Reiniciar
docker compose restart [service]

# Parar tudo
docker compose down

# Iniciar tudo
docker compose up -d

# Rebuild
docker compose up -d --build

# Health check
./health-check.sh
```

---

## 🔐 Credenciais Padrão

**Frontend:**
- Email: `admin@saasbot.com`
- Senha: `admin123`

**PostgreSQL SaaS:**
- User: `saasbot`
- Password: `saasbot123`
- Database: `saasbot`
- Port: `5433`

**PostgreSQL Typebot:**
- User: `typebot`
- Password: `typebotpass`
- Database: `typebot`

**Redis:**
- Port: `6380`

---

## 🔍 Troubleshooting Rápido

### Container não inicia
```bash
docker compose logs [service]
docker compose restart [service]
```

### SSL não funciona
```bash
# Verificar DNS
nslookup app.promolinxy.online

# Verificar firewall
ufw allow 80/tcp
ufw allow 443/tcp

# Logs do Caddy
docker compose logs caddy
```

### Backend não conecta
```bash
# Verificar health
curl http://localhost:3001/health

# Logs
docker compose logs whatsapp-engine
```

### Banco de dados erro
```bash
# Testar conexão
docker compose exec postgres-saas psql -U saasbot -d saasbot -c "SELECT 1;"
```

---

## 💾 Backup

```bash
# Backup databases
docker compose exec -T postgres-saas pg_dump -U saasbot saasbot > backup-saas.sql
docker compose exec -T postgres-typebot pg_dump -U typebot typebot > backup-typebot.sql

# Backup volumes
tar -czf backup-volumes.tar.gz ./postgres-saas ./pgdata ./n8n
```

---

## 🔄 Atualizar

```bash
cd /root/stack
docker compose pull
docker compose up -d --build
docker image prune -a
```

---

## 📊 Monitoramento

```bash
# Status containers
docker compose ps

# Recursos
docker stats

# Espaço em disco
df -h
docker system df

# Health check
./health-check.sh
```

---

## 🆘 Suporte

Documentação completa: [DEPLOY-VPS.md](./DEPLOY-VPS.md)

Logs detalhados:
```bash
docker compose logs --tail=200 > debug.log
```
