# 🚀 Deploy na VPS - PromoLinxy SaaS Bot

## 📝 Visão Geral

Este repositório contém todos os arquivos necessários para fazer o deploy completo do ecossistema SaaS na VPS usando Docker Compose e Caddy como reverse proxy.

### Serviços Incluídos

- **Frontend Next.js** - Dashboard de gerenciamento
- **Backend WhatsApp Engine** - API e automação WhatsApp
- **Typebot Builder** - Criação de fluxos de chatbot
- **Typebot Viewer** - Visualização e execução de bots
- **N8N** - Automação de workflows
- **PostgreSQL (2 instâncias)** - Banco de dados para SaaS e Typebot
- **Redis** - Cache e filas
- **Caddy** - Reverse proxy com SSL automático

---

## 🎯 Início Rápido

### Pré-requisitos

1. **VPS configurada** com Ubuntu 20.04+
2. **DNS configurado** apontando para o IP da VPS:
   - app.promolinxy.online
   - backend.promolinxy.online
   - builder.promolinxy.online
   - bot.promolinxy.online
   - n8n.promolinxy.online

### Deploy em 3 Passos

```bash
# 1. Setup da VPS (apenas primeira vez)
wget -O - https://raw.githubusercontent.com/kauameloo/promolinxy-saas-bot-whatsapp/main/deploy/setup-vps.sh | bash

# 2. Clone e configure
cd /root/stack
git clone https://github.com/kauameloo/promolinxy-saas-bot-whatsapp.git temp
cp temp/docker-compose.yml temp/Caddyfile temp/.env.example .
cp .env.example .env
mkdir -p promolinxy-saas-bot-whatsapp
cp -r temp/scripts promolinxy-saas-bot-whatsapp/
rm -rf temp

# Edite o .env com suas credenciais
nano .env

# 3. Deploy
docker compose up -d
```

---

## 📚 Documentação Completa

- **[Guia Completo de Deploy](./docs/DEPLOY-VPS.md)** - Instruções detalhadas passo a passo
- **[Referência Rápida](./docs/QUICK-REFERENCE.md)** - Comandos essenciais e troubleshooting

---

## 🌐 URLs dos Serviços

Após o deploy, os serviços estarão disponíveis em:

| Serviço | URL |
|---------|-----|
| 🎨 Frontend | https://app.promolinxy.online |
| 🔧 Backend API | https://backend.promolinxy.online |
| 🤖 Typebot Builder | https://builder.promolinxy.online |
| 💬 Typebot Viewer | https://bot.promolinxy.online |
| ⚙️ N8N | https://n8n.promolinxy.online |

---

## 📋 Arquivos Principais

- **`docker-compose.yml`** - Orquestração de todos os serviços
- **`Caddyfile`** - Configuração do reverse proxy e SSL
- **`.env.example`** - Template de variáveis de ambiente
- **`deploy/setup-vps.sh`** - Script de configuração inicial da VPS
- **`deploy/deploy.sh`** - Script de deploy automatizado
- **`deploy/health-check.sh`** - Script de verificação de saúde dos serviços
- **`scripts/001-create-database-schema.sql`** - Schema do banco de dados

---

## 🔧 Comandos Úteis

```bash
# Ver status dos containers
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# Reiniciar um serviço
docker compose restart [service-name]

# Parar tudo
docker compose down

# Iniciar tudo
docker compose up -d

# Rebuild após mudanças
docker compose up -d --build

# Health check
cd /root/stack
./health-check.sh
```

---

## 🔐 Credenciais Padrão

**IMPORTANTE**: Altere as credenciais padrão no arquivo `.env` antes do deploy!

**Frontend:**
- Email: `admin@saasbot.com`
- Senha: `admin123`

**PostgreSQL SaaS:**
- User: `saasbot`
- Password: `saasbot123` (altere no .env!)
- Database: `saasbot`

---

## 🆘 Troubleshooting

### Container não inicia
```bash
docker compose logs [service-name]
docker compose restart [service-name]
```

### SSL não funciona
```bash
# Verificar DNS
nslookup app.promolinxy.online

# Verificar logs do Caddy
docker compose logs caddy
```

### Backend não conecta
```bash
curl http://localhost:3001/health
docker compose logs whatsapp-engine
```

Para mais detalhes, consulte o [Guia Completo](./docs/DEPLOY-VPS.md).

---

## 📞 Suporte

- **Documentação**: [DEPLOY-VPS.md](./docs/DEPLOY-VPS.md)
- **Referência Rápida**: [QUICK-REFERENCE.md](./docs/QUICK-REFERENCE.md)
- **Issues**: [GitHub Issues](https://github.com/kauameloo/promolinxy-saas-bot-whatsapp/issues)

---

## ✅ Checklist de Deploy

- [ ] DNS configurado e propagado
- [ ] VPS preparada com setup-vps.sh
- [ ] Arquivos copiados para /root/stack
- [ ] .env configurado com credenciais seguras
- [ ] docker-compose up -d executado
- [ ] Todos os containers rodando (docker compose ps)
- [ ] SSL funcionando (cadeado verde)
- [ ] Frontend acessível
- [ ] Backend respondendo /health
- [ ] Login funcionando
- [ ] WhatsApp conectando
- [ ] Backup configurado

---

## 📦 Estrutura do Projeto

```
promolinxy-saas-bot-whatsapp/
├── app/                          # Páginas Next.js
├── components/                   # Componentes React
├── docker/                       # Dockerfiles
│   ├── Dockerfile.frontend       # Build do frontend
│   └── Dockerfile.backend        # Build do backend
├── deploy/                       # Scripts de deploy
│   ├── setup-vps.sh             # Setup inicial da VPS
│   ├── deploy.sh                # Deploy automatizado
│   └── health-check.sh          # Verificação de saúde
├── docs/                         # Documentação
│   ├── DEPLOY-VPS.md            # Guia completo
│   └── QUICK-REFERENCE.md       # Referência rápida
├── lib/                          # Bibliotecas
├── scripts/                      # Scripts SQL
│   └── 001-create-database-schema.sql
├── docker-compose.yml            # Orquestração Docker
├── Caddyfile                     # Configuração Caddy
├── .env.example                  # Template de variáveis
└── README.md                     # Este arquivo
```

---

## 🎉 Pronto!

Seu ecossistema SaaS está pronto para deploy!

Siga o [Guia Completo](./docs/DEPLOY-VPS.md) para instruções detalhadas.
