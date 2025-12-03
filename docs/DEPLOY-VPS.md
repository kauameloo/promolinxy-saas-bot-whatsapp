# 🚀 Guia de Deploy VPS - PromoLinxy SaaS Bot

Este guia contém todas as instruções para fazer o deploy completo do ecossistema SaaS na sua VPS.

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Estrutura de Arquivos](#estrutura-de-arquivos)
3. [Configuração Inicial](#configuração-inicial)
4. [Deploy](#deploy)
5. [Validação](#validação)
6. [Troubleshooting](#troubleshooting)
7. [Manutenção](#manutenção)

---

## 🔧 Pré-requisitos

### VPS Requirements
- **OS**: Ubuntu 20.04 LTS ou superior
- **RAM**: Mínimo 4GB (recomendado 8GB)
- **CPU**: Mínimo 2 cores
- **Disco**: Mínimo 20GB de espaço livre
- **IP Público**: Necessário
- **Acesso Root**: Via SSH

### DNS Configuration
Configure os seguintes registros DNS apontando para o IP da sua VPS:

```
A     app.promolinxy.online       ->  SEU_IP_VPS
A     backend.promolinxy.online   ->  SEU_IP_VPS
A     builder.promolinxy.online   ->  SEU_IP_VPS
A     bot.promolinxy.online       ->  SEU_IP_VPS
A     n8n.promolinxy.online       ->  SEU_IP_VPS
```

**⚠️ IMPORTANTE**: Aguarde a propagação do DNS (pode levar até 24h, mas geralmente 5-30 minutos).

Verifique a propagação:
```bash
nslookup app.promolinxy.online
dig app.promolinxy.online
```

---

## 📁 Estrutura de Arquivos

Na VPS, a estrutura deve ficar assim:

```
/root/stack/
├── docker-compose.yml              # Orquestração dos containers
├── Caddyfile                       # Configuração do reverse proxy
├── .env                            # Variáveis de ambiente
├── pgdata/                         # Dados do PostgreSQL Typebot
├── postgres-saas/                  # Dados do PostgreSQL SaaS
├── caddy_data/                     # Dados do Caddy (certificados SSL)
├── caddy_config/                   # Configuração do Caddy
├── n8n/                            # Dados do N8N
└── promolinxy-saas-bot-whatsapp/
    └── scripts/
        └── 001-create-database-schema.sql
```

---

## ⚙️ Configuração Inicial

### Passo 1: Setup do Sistema

```bash
# Conecte-se à VPS via SSH
ssh root@SEU_IP_VPS

# Execute o script de setup
cd /root
wget https://raw.githubusercontent.com/kauameloo/promolinxy-saas-bot-whatsapp/main/deploy/setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh
```

Este script irá:
- ✅ Atualizar o sistema
- ✅ Instalar Docker e Docker Compose
- ✅ Criar diretórios necessários
- ✅ Configurar firewall

### Passo 2: Upload dos Arquivos

**Opção A - Via Git (Recomendado):**

```bash
cd /root/stack
git clone https://github.com/kauameloo/promolinxy-saas-bot-whatsapp.git temp
cp temp/docker-compose.yml .
cp temp/Caddyfile .
cp temp/.env.example .env
cp -r temp/scripts promolinxy-saas-bot-whatsapp/
rm -rf temp
```

**Opção B - Via SCP (do seu computador):**

```bash
# Do seu computador local
scp docker-compose.yml root@SEU_IP_VPS:/root/stack/
scp Caddyfile root@SEU_IP_VPS:/root/stack/
scp .env.example root@SEU_IP_VPS:/root/stack/.env
scp -r scripts root@SEU_IP_VPS:/root/stack/promolinxy-saas-bot-whatsapp/
```

### Passo 3: Configurar Variáveis de Ambiente

```bash
cd /root/stack
nano .env
```

**Variáveis OBRIGATÓRIAS para editar:**

```bash
# Segurança - MUDE ESTAS SENHAS!
JWT_SECRET=sua-chave-super-secreta-aqui-minimo-64-caracteres
POSTGRES_PASSWORD=sua-senha-postgres-forte-aqui
TYPEBOT_NEXTAUTH_SECRET=outra-chave-secreta-aqui

# Webhook Cakto (se usar)
CAKTO_WEBHOOK_SECRET=seu-webhook-secret

# GitHub OAuth (se usar Typebot com GitHub)
TYPEBOT_GITHUB_CLIENT_ID=seu-client-id
TYPEBOT_GITHUB_CLIENT_SECRET=seu-client-secret
```

**💡 Dica**: Para gerar senhas seguras:
```bash
openssl rand -base64 32
```

### Passo 4: Verificar Estrutura

```bash
cd /root/stack
tree -L 2  # ou ls -la
```

Certifique-se que:
- ✅ `docker-compose.yml` existe e é um arquivo
- ✅ `Caddyfile` existe e é um arquivo (NÃO um diretório)
- ✅ `.env` existe e está configurado
- ✅ `promolinxy-saas-bot-whatsapp/scripts/` existe com o schema SQL

---

## 🚀 Deploy

### Executar Deploy

```bash
cd /root/stack

# Método 1: Usar script de deploy
wget https://raw.githubusercontent.com/kauameloo/promolinxy-saas-bot-whatsapp/main/deploy/deploy.sh
chmod +x deploy.sh
./deploy.sh

# Método 2: Manual
docker compose pull
docker compose build --no-cache
docker compose up -d
```

### Acompanhar Deploy

```bash
# Ver logs de todos os serviços
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f frontend
docker compose logs -f whatsapp-engine
docker compose logs -f caddy

# Ver status dos containers
docker compose ps
```

**⏱️ Tempo esperado**: 5-10 minutos para tudo inicializar.

---

## ✅ Validação

### 1. Verificar Containers

```bash
docker compose ps
```

Todos os serviços devem estar **Up** (não Exited):
- ✅ postgres-typebot
- ✅ postgres-saas
- ✅ redis
- ✅ typebot-builder
- ✅ typebot-viewer
- ✅ n8n
- ✅ whatsapp-engine
- ✅ frontend
- ✅ caddy

### 2. Executar Health Check

```bash
cd /root/stack
wget https://raw.githubusercontent.com/kauameloo/promolinxy-saas-bot-whatsapp/main/deploy/health-check.sh
chmod +x health-check.sh
./health-check.sh
```

### 3. Testar URLs Manualmente

```bash
# Testar SSL e conectividade
curl -I https://app.promolinxy.online
curl -I https://backend.promolinxy.online/health
curl -I https://builder.promolinxy.online
curl -I https://bot.promolinxy.online
curl -I https://n8n.promolinxy.online
```

Todos devem retornar **HTTP/2 200** ou **302**.

### 4. Acessar no Navegador

Abra cada URL no navegador:

1. **Frontend**: https://app.promolinxy.online
   - Login: `admin@saasbot.com`
   - Senha: `admin123`

2. **Backend API**: https://backend.promolinxy.online/health
   - Deve retornar JSON: `{"status": "ok"}`

3. **Typebot Builder**: https://builder.promolinxy.online
   - Interface do Typebot

4. **Typebot Viewer**: https://bot.promolinxy.online
   - Interface de visualização de bots

5. **N8N**: https://n8n.promolinxy.online
   - Interface do N8N

### 5. Verificar SSL

```bash
# Verificar certificado SSL
echo | openssl s_client -servername app.promolinxy.online -connect app.promolinxy.online:443 2>/dev/null | openssl x509 -noout -dates
```

Deve mostrar datas de validade do Let's Encrypt.

### 6. Testar Comunicação Backend ↔ Frontend

No frontend, tente:
1. Fazer login
2. Criar uma sessão WhatsApp
3. Ver o QR Code
4. Enviar uma mensagem de teste

---

## 🔧 Troubleshooting

### Problema: Caddy não inicia

**Erro**: `bind: address already in use`

**Solução**:
```bash
# Verificar o que está usando a porta 80/443
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Parar serviços conflitantes
systemctl stop nginx
systemctl stop apache2

# Reiniciar Caddy
docker compose restart caddy
```

### Problema: SSL não funciona

**Erro**: `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`

**Causas comuns**:
1. DNS não propagou ainda
2. Firewall bloqueando portas 80/443
3. Caddyfile com erro de sintaxe

**Soluções**:
```bash
# 1. Verificar DNS
nslookup app.promolinxy.online

# 2. Verificar firewall
ufw status
ufw allow 80/tcp
ufw allow 443/tcp

# 3. Verificar logs do Caddy
docker compose logs caddy

# 4. Validar Caddyfile
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

### Problema: Frontend não conecta no backend

**Erro**: `Network Error` ou `CORS Error`

**Solução**:
```bash
# 1. Verificar se backend está rodando
docker compose ps whatsapp-engine
docker compose logs whatsapp-engine

# 2. Verificar se health endpoint responde
curl http://localhost:3001/health

# 3. Verificar variáveis de ambiente
docker compose exec frontend env | grep API
docker compose exec frontend env | grep WHATSAPP
```

### Problema: Banco de dados não conecta

**Erro**: `Connection refused` ou `Authentication failed`

**Solução**:
```bash
# 1. Verificar se PostgreSQL está rodando
docker compose ps postgres-saas
docker compose logs postgres-saas

# 2. Testar conexão
docker compose exec postgres-saas psql -U saasbot -d saasbot -c "SELECT 1;"

# 3. Verificar senha no .env
grep POSTGRES .env

# 4. Recriar banco se necessário
docker compose down postgres-saas
sudo rm -rf postgres-saas/*
docker compose up -d postgres-saas
```

### Problema: Container reiniciando constantemente

```bash
# Ver últimos logs antes do crash
docker compose logs --tail=100 [nome-do-container]

# Verificar recursos do sistema
free -h
df -h
top
```

---

## 🛠️ Manutenção

### Backup do Banco de Dados

```bash
# Backup PostgreSQL SaaS
docker compose exec -T postgres-saas pg_dump -U saasbot saasbot > backup-saas-$(date +%Y%m%d).sql

# Backup PostgreSQL Typebot
docker compose exec -T postgres-typebot pg_dump -U typebot typebot > backup-typebot-$(date +%Y%m%d).sql

# Compactar backups
tar -czf backups-$(date +%Y%m%d).tar.gz backup-*.sql
```

### Restaurar Backup

```bash
# Restaurar SaaS
docker compose exec -T postgres-saas psql -U saasbot saasbot < backup-saas-YYYYMMDD.sql

# Restaurar Typebot
docker compose exec -T postgres-typebot psql -U typebot typebot < backup-typebot-YYYYMMDD.sql
```

### Atualizar Imagens

```bash
cd /root/stack

# Pull novas versões
docker compose pull

# Rebuild e restart
docker compose up -d --build

# Limpar imagens antigas
docker image prune -a
```

### Ver Logs

```bash
# Logs em tempo real
docker compose logs -f

# Últimas 100 linhas
docker compose logs --tail=100

# Logs de um serviço específico
docker compose logs -f whatsapp-engine

# Salvar logs em arquivo
docker compose logs > logs-$(date +%Y%m%d-%H%M%S).txt
```

### Reiniciar Serviços

```bash
# Reiniciar tudo
docker compose restart

# Reiniciar serviço específico
docker compose restart frontend
docker compose restart whatsapp-engine
docker compose restart caddy

# Parar tudo
docker compose down

# Iniciar tudo
docker compose up -d
```

### Limpar Espaço em Disco

```bash
# Remover containers parados
docker container prune

# Remover imagens não usadas
docker image prune -a

# Remover volumes não usados (CUIDADO!)
docker volume prune

# Ver uso de disco
docker system df

# Limpeza completa (CUIDADO!)
docker system prune -a --volumes
```

---

## 📞 Comandos Úteis

```bash
# Status geral
docker compose ps

# Logs em tempo real
docker compose logs -f

# Acessar shell de um container
docker compose exec frontend sh
docker compose exec whatsapp-engine bash
docker compose exec postgres-saas psql -U saasbot

# Ver uso de recursos
docker stats

# Ver redes
docker network ls

# Ver volumes
docker volume ls

# Rebuild apenas um serviço
docker compose up -d --build frontend

# Forçar recreação de containers
docker compose up -d --force-recreate
```

---

## ✅ Checklist Final

Após o deploy, verifique:

- [ ] Todos os containers estão rodando (`docker compose ps`)
- [ ] SSL funciona em todos os domínios (cadeado verde no navegador)
- [ ] Frontend acessível em https://app.promolinxy.online
- [ ] Backend responde em https://backend.promolinxy.online/health
- [ ] Typebot Builder acessível
- [ ] Typebot Viewer acessível
- [ ] N8N acessível
- [ ] Login funciona no frontend
- [ ] Sessão WhatsApp pode ser criada
- [ ] QR Code aparece
- [ ] Mensagens podem ser enviadas
- [ ] Banco de dados está persistindo dados
- [ ] Backup está configurado

---

## 🎉 Pronto!

Seu ecossistema SaaS está rodando na VPS!

Para suporte adicional, consulte:
- Logs: `docker compose logs -f`
- Status: `./health-check.sh`
- Documentação do projeto: README.md

**Próximos passos**:
1. Configure backups automáticos
2. Configure monitoramento (opcional)
3. Ajuste recursos conforme necessidade
4. Configure alertas de downtime (opcional)
