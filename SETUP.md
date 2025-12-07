# 🚀 Guia Completo de Configuração - SaaS Bot WhatsApp

Este documento contém **todas as instruções detalhadas** para configurar e rodar o projeto SaaS Bot WhatsApp com integração Cakto na sua máquina local.

---

## ⚡ INÍCIO RÁPIDO - Rodando Localmente em 5 Minutos

> **Siga esses passos para ter o projeto funcionando na sua máquina!**

### 1️⃣ Pré-requisitos Obrigatórios

Antes de começar, certifique-se de ter instalado:

- **Node.js 18+** → [Baixar aqui](https://nodejs.org/)
- **PostgreSQL 15+** → [Baixar aqui](https://www.postgresql.org/download/) OU use [Neon](https://neon.tech) (gratuito online)

Para verificar se está instalado:
\`\`\`bash
node --version    # Deve mostrar v18.x.x ou superior
npm --version     # Deve mostrar 9.x.x ou superior
\`\`\`

### 2️⃣ Clonar o Projeto

\`\`\`bash
git clone https://github.com/kauameloo/promolinxy-saas-bot-whatsapp.git
cd promolinxy-saas-bot-whatsapp
\`\`\`

### 3️⃣ Instalar Dependências

\`\`\`bash
npm install
\`\`\`

### 4️⃣ Configurar o Banco de Dados

**Opção A - Usando Neon (mais fácil, online e gratuito):**

1. Acesse [neon.tech](https://neon.tech) e crie uma conta gratuita
2. Clique em "Create Project" e dê um nome (ex: `saasbot`)
3. Copie a "Connection String" que aparece
4. Crie o arquivo `.env` na raiz do projeto:

\`\`\`bash
cp .env.example .env
\`\`\`

5. Abra o `.env` e cole a connection string:

\`\`\`bash
DATABASE_URL=postgresql://seu-usuario:sua-senha@ep-xxx.neon.tech/neondb?sslmode=require
JWT_SECRET=minha-chave-secreta-super-segura-com-mais-de-64-caracteres-aqui-ok
\`\`\`

6. No Neon, vá em "SQL Editor" e cole todo o conteúdo do arquivo `scripts/001-create-database-schema.sql`, depois clique em "Run"

**Opção B - Usando PostgreSQL Local:**

\`\`\`bash
# 1. Criar banco e usuário (no terminal do PostgreSQL)
sudo -u postgres psql
CREATE USER saasbot WITH PASSWORD 'saasbot123';
CREATE DATABASE saasbot OWNER saasbot;
GRANT ALL PRIVILEGES ON DATABASE saasbot TO saasbot;
\q

# 2. Executar schema
psql -U saasbot -d saasbot -f scripts/001-create-database-schema.sql

# 3. Criar arquivo .env
cp .env.example .env
\`\`\`

No arquivo `.env`, configure:
\`\`\`bash
DATABASE_URL=postgresql://saasbot:saasbot123@localhost:5432/saasbot
JWT_SECRET=minha-chave-secreta-super-segura-com-mais-de-64-caracteres-aqui-ok
\`\`\`

### 5️⃣ Rodar o Projeto

\`\`\`bash
npm run dev
\`\`\`

### 6️⃣ Acessar o Dashboard

1. Abra o navegador: **http://localhost:3000**
2. Faça login com:
   - 📧 **Email:** `admin@saasbot.com`
   - 🔑 **Senha:** `admin123`

> **💡 Nota:** O login do admin funciona mesmo se o banco de dados não estiver configurado inicialmente, permitindo que você acesse o dashboard para diagnóstico. No entanto, para funcionalidade completa, configure o banco de dados conforme o passo 4.

> **⚠️ SEGURANÇA:** Troque a senha padrão do admin após o primeiro login em ambientes de produção. As credenciais padrão devem ser usadas apenas para configuração inicial.

### ✅ Pronto! O projeto está rodando!

Agora você pode:
- Ver o Dashboard com estatísticas
- Criar fluxos de mensagens
- Visualizar clientes e pedidos
- Ver logs de mensagens

---

## 🛠️ Comandos Úteis para Desenvolvimento Local

\`\`\`bash
# Iniciar servidor de desenvolvimento (Frontend)
npm run dev

# Build de produção (Frontend)
npm run build

# Build do Backend (WhatsApp Engine)
npm run build:backend

# Build completo (Frontend + Backend)
npm run build:all

# Iniciar em modo produção (após build)
npm run start

# Iniciar Backend com PM2
npx pm2-runtime start ecosystem.config.js

# Verificar erros de lint
npm run lint

# Limpar cache do Next.js (se tiver problemas)
rm -rf .next
\`\`\`

---

## 📋 Índice (Documentação Avançada)

> As seções abaixo são para configurações avançadas e deploy em produção.

1. [Visão Geral do Projeto](#-visão-geral-do-projeto)
2. [Pré-requisitos (Detalhado)](#-pré-requisitos)
3. [Estrutura do Projeto](#-estrutura-do-projeto)
4. [Configuração do Ambiente](#-configuração-do-ambiente)
5. [Instalação Local (Detalhada)](#-instalação-local-desenvolvimento)
6. [Configuração do Banco de Dados (Detalhada)](#-configuração-do-banco-de-dados)
7. [Deploy com Docker (Produção)](#-deploy-com-docker)
8. [Deploy na Vercel (Produção)](#-deploy-na-vercel-frontend)
9. [Configuração do WhatsApp Engine](#-configuração-do-whatsapp-engine)
10. [Configuração dos Webhooks Cakto](#-configuração-dos-webhooks-cakto)
11. [Endpoints da API](#-endpoints-da-api)
12. [Guia de Uso do Dashboard](#-guia-de-uso-do-dashboard)
13. [Monitoramento e Logs](#-monitoramento-e-logs)
14. [Backup e Recuperação](#-backup-e-recuperação)
15. [Troubleshooting](#-troubleshooting)
16. [Segurança](#-segurança)
17. [FAQ - Perguntas Frequentes](#-faq---perguntas-frequentes)

---

## 🎯 Visão Geral do Projeto

O **SaaS Bot WhatsApp** é um sistema completo de automação de mensagens WhatsApp integrado com a plataforma **Cakto** para recuperação de vendas e engajamento de clientes.

### Funcionalidades Principais

| Funcionalidade | Descrição |
|----------------|-----------|
| **Webhooks Cakto** | Recebe e processa eventos de pagamento automaticamente |
| **Fluxos Automatizados** | Sequências de mensagens personalizadas com delays |
| **Dashboard Moderno** | Interface completa para gerenciamento |
| **Multi-tenancy** | Arquitetura pronta para SaaS (múltiplos clientes) |
| **WhatsApp Engine** | Envio automatizado de mensagens via WhatsApp |
| **Analytics** | Métricas e relatórios de performance |

### Eventos Suportados da Cakto

| Evento | Descrição |
|--------|-----------|
| `boleto_gerado` | Boleto gerado para pagamento |
| `pix_gerado` | PIX gerado para pagamento |
| `picpay_gerado` | PicPay gerado para pagamento |
| `openfinance_nubank_gerado` | Nubank OpenFinance |
| `checkout_abandonment` | Abandono de carrinho |
| `purchase_approved` | Compra aprovada |
| `purchase_refused` | Compra recusada |

---

## 💻 Pré-requisitos

### Para Desenvolvimento Local

| Requisito | Versão Mínima | Download |
|-----------|---------------|----------|
| **Node.js** | 18.x ou superior | [nodejs.org](https://nodejs.org/) |
| **npm** ou **pnpm** | npm 9.x / pnpm 8.x | Vem com Node.js / [pnpm.io](https://pnpm.io/) |
| **Git** | 2.x | [git-scm.com](https://git-scm.com/) |
| **PostgreSQL** | 15+ (ou Neon Database) | [postgresql.org](https://www.postgresql.org/) |

### Para Deploy com Docker

| Requisito | Versão Mínima | Instalação |
|-----------|---------------|------------|
| **Docker** | 24.x | [docs.docker.com](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.x | Incluído no Docker Desktop |

### Para o WhatsApp Engine (VPS)

| Requisito | Especificação Mínima |
|-----------|---------------------|
| **Sistema Operacional** | Ubuntu 20.04+ ou Debian 11+ |
| **RAM** | 2GB mínimo (4GB recomendado) |
| **CPU** | 2 vCPUs |
| **Armazenamento** | 20GB SSD |
| **Chromium/Chrome** | Necessário para Puppeteer |

---

## 📁 Estrutura do Projeto

\`\`\`
promolinxy-saas-bot-whatsapp/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Autenticação (login/logout)
│   │   ├── customers/            # CRUD de clientes
│   │   ├── dashboard/            # Stats e métricas
│   │   ├── events/               # Eventos de webhook
│   │   ├── flows/                # Fluxos de mensagens
│   │   ├── logs/                 # Logs de mensagens
│   │   ├── orders/               # Pedidos
│   │   ├── settings/             # Configurações
│   │   ├── webhooks/             # Endpoint Cakto
│   │   └── whatsapp/             # Status do WhatsApp
│   ├── dashboard/                # Páginas do dashboard
│   │   ├── analytics/            # Página de analytics
│   │   ├── customers/            # Lista de clientes
│   │   ├── events/               # Lista de eventos
│   │   ├── flows/                # Gerenciar fluxos
│   │   ├── logs/                 # Logs de mensagens
│   │   ├── orders/               # Lista de pedidos
│   │   ├── settings/             # Configurações
│   │   └── whatsapp/             # Status WhatsApp
│   ├── login/                    # Página de login
│   ├── globals.css               # Estilos globais
│   ├── layout.tsx                # Layout raiz
│   └── page.tsx                  # Página inicial
│
├── components/                   # Componentes React
│   ├── dashboard/                # Componentes do dashboard
│   ├── ui/                       # Componentes shadcn/ui
│   └── theme-provider.tsx        # Provider de tema
│
├── lib/                          # Utilitários e serviços (Frontend)
│   ├── constants/                # Constantes do sistema
│   │   ├── config.ts             # Configurações
│   │   └── default-flows.ts      # Fluxos padrão
│   ├── hooks/                    # React Hooks
│   ├── services/                 # Serviços de negócio
│   │   ├── analytics-service.ts
│   │   ├── customer-service.ts
│   │   ├── flow-service.ts
│   │   ├── message-service.ts
│   │   ├── order-service.ts
│   │   └── webhook-service.ts
│   ├── types/                    # TypeScript types
│   ├── utils/                    # Funções utilitárias
│   ├── whatsapp/                 # Engine WhatsApp (API reference)
│   │   ├── engine.ts
│   │   ├── message-queue.ts
│   │   └── types.ts
│   ├── db.ts                     # Conexão com banco (Neon)
│   └── utils.ts                  # Utilitários gerais
│
├── src/                          # Backend Sources (WhatsApp Engine)
│   └── backend/                  # Código do servidor backend
│       ├── whatsapp-server.ts    # Servidor Express + WhatsApp
│       ├── queue-worker.ts       # Worker de fila de mensagens
│       └── lib/                  # Bibliotecas do backend
│           ├── db.ts             # Conexão PostgreSQL (pg)
│           ├── types.ts          # Tipos TypeScript
│           ├── whatsapp-engine.ts # Engine WhatsApp
│           └── message-queue.ts  # Fila de mensagens
│
├── dist/                         # Backend compilado (gerado)
│   ├── whatsapp-server.js        # Servidor compilado
│   ├── queue-worker.js           # Worker compilado
│   └── lib/                      # Bibliotecas compiladas
│
├── docker/                       # Configurações Docker
│   ├── Dockerfile.frontend       # Build do frontend
│   ├── Dockerfile.backend        # Build do WhatsApp Engine
│   └── nginx.conf                # Configuração Nginx
│
├── scripts/                      # Scripts SQL
│   └── 001-create-database-schema.sql
│
├── docs/                         # Documentação adicional
│   ├── DEPLOY.md
│   └── README.md
│
├── public/                       # Arquivos estáticos
├── styles/                       # Estilos adicionais
│
├── .env.example                  # Exemplo de variáveis de ambiente
├── docker-compose.yml            # Orquestração Docker
├── ecosystem.config.js           # Configuração PM2
├── next.config.mjs               # Configuração Next.js
├── package.json                  # Dependências
├── tsconfig.json                 # TypeScript config (Frontend)
├── tsconfig.backend.json         # TypeScript config (Backend)
└── README.md                     # Documentação básica
\`\`\`

---

## ⚙️ Configuração do Ambiente

### Passo 1: Clonar o Repositório

\`\`\`bash
# Clone o repositório
git clone https://github.com/kauameloo/promolinxy-saas-bot-whatsapp.git

# Entre no diretório
cd promolinxy-saas-bot-whatsapp
\`\`\`

### Passo 2: Criar o Arquivo .env

\`\`\`bash
# Copie o arquivo de exemplo
cp .env.example .env
\`\`\`

### Passo 3: Configurar as Variáveis de Ambiente

Abra o arquivo `.env` e configure cada variável:

\`\`\`bash
# =====================================================
# SAAS BOT WHATSAPP - Environment Variables
# =====================================================

# ========== BANCO DE DADOS ==========
# Opção 1: Neon Database (recomendado para produção)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Opção 2: PostgreSQL local (para desenvolvimento)
# DATABASE_URL=postgresql://saasbot:saasbot123@localhost:5432/saasbot

# ========== AUTENTICAÇÃO ==========
# Chave secreta para JWT (IMPORTANTE: mude em produção!)
# Use no mínimo 64 caracteres para segurança adequada
# Gere com: openssl rand -base64 64
JWT_SECRET=sua-chave-super-secreta-altere-em-producao-com-minimo-64-caracteres-aqui

# ========== WEBHOOK CAKTO ==========
# Secret para validar assinaturas dos webhooks (opcional, mas recomendado)
CAKTO_WEBHOOK_SECRET=seu-cakto-webhook-secret

# ========== POSTGRESQL (Docker) ==========
# Usado apenas quando rodar com Docker Compose
POSTGRES_USER=saasbot
POSTGRES_PASSWORD=saasbot123
POSTGRES_DB=saasbot

# ========== AMBIENTE ==========
NODE_ENV=development

# ========== WHATSAPP ENGINE ==========
# Caminho para salvar sessões do WhatsApp
WHATSAPP_SESSION_PATH=/app/sessions

# ========== TENANT ==========
# ID do tenant padrão (para modo single-tenant)
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
\`\`\`

### Explicação das Variáveis

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | ✅ Sim | String de conexão do PostgreSQL |
| `JWT_SECRET` | ✅ Sim | Chave secreta para tokens JWT (mínimo 32 caracteres) |
| `CAKTO_WEBHOOK_SECRET` | ❌ Não | Secret para validar webhooks da Cakto |
| `POSTGRES_USER` | Docker | Usuário do PostgreSQL no Docker |
| `POSTGRES_PASSWORD` | Docker | Senha do PostgreSQL no Docker |
| `POSTGRES_DB` | Docker | Nome do banco no Docker |
| `NODE_ENV` | ❌ Não | Ambiente (development/production) |
| `WHATSAPP_SESSION_PATH` | ❌ Não | Caminho para salvar sessões WhatsApp |
| `DEFAULT_TENANT_ID` | ❌ Não | ID do tenant padrão |

---

## 🛠️ Instalação Local (Desenvolvimento)

### Passo 1: Instalar Dependências

\`\`\`bash
# Usando npm
npm install

# OU usando pnpm (mais rápido)
pnpm install
\`\`\`

### Passo 2: Configurar o Banco de Dados

Veja a seção [Configuração do Banco de Dados](#-configuração-do-banco-de-dados).

### Passo 3: Rodar em Modo Desenvolvimento

\`\`\`bash
# Inicia o servidor de desenvolvimento
npm run dev

# OU com pnpm
pnpm dev
\`\`\`

O servidor estará disponível em: **http://localhost:3000**

### Passo 4: Acessar o Dashboard

1. Abra o navegador em `http://localhost:3000`
2. Você será redirecionado para a página de login
3. Use as credenciais padrão:
   - **Email:** `admin@saasbot.com`
   - **Senha:** `admin123`

### Comandos Úteis de Desenvolvimento

\`\`\`bash
# Rodar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar em modo produção
npm run start

# Verificar erros de lint
npm run lint

# Limpar cache do Next.js
rm -rf .next
\`\`\`

---

## 🗄️ Configuração do Banco de Dados

### Opção 1: Neon Database (Recomendado para Produção)

O [Neon](https://neon.tech/) é um PostgreSQL serverless ideal para aplicações Next.js.

#### Passo 1: Criar Conta no Neon

1. Acesse [neon.tech](https://neon.tech/)
2. Crie uma conta gratuita
3. Clique em "Create Project"
4. Escolha um nome para o projeto (ex: `saasbot-whatsapp`)
5. Selecione a região mais próxima (ex: `US East` ou `EU`)

#### Passo 2: Obter a Connection String

1. No dashboard do Neon, vá em "Connection Details"
2. Copie a connection string (será algo como):
   \`\`\`
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   \`\`\`
3. Cole no arquivo `.env`:
   \`\`\`bash
   DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   \`\`\`

#### Passo 3: Executar o Schema

1. No dashboard do Neon, clique em "SQL Editor"
2. Copie todo o conteúdo do arquivo `scripts/001-create-database-schema.sql`
3. Cole no SQL Editor e clique em "Run"
4. Verifique se todas as tabelas foram criadas

### Opção 2: PostgreSQL Local

#### Instalar PostgreSQL

**Ubuntu/Debian:**
\`\`\`bash
sudo apt update
sudo apt install postgresql postgresql-contrib
\`\`\`

**macOS (Homebrew):**
\`\`\`bash
brew install postgresql@15
brew services start postgresql@15
\`\`\`

**Windows:**
Baixe o instalador em [postgresql.org](https://www.postgresql.org/download/windows/)

#### Criar Banco de Dados

\`\`\`bash
# Conectar ao PostgreSQL
sudo -u postgres psql

# Criar usuário
CREATE USER saasbot WITH PASSWORD 'saasbot123';

# Criar banco de dados
CREATE DATABASE saasbot OWNER saasbot;

# Dar permissões
GRANT ALL PRIVILEGES ON DATABASE saasbot TO saasbot;

# Sair
\q
\`\`\`

#### Executar o Schema

\`\`\`bash
# Executar o script SQL
psql -U saasbot -d saasbot -f scripts/001-create-database-schema.sql
\`\`\`

#### Configurar .env

\`\`\`bash
DATABASE_URL=postgresql://saasbot:saasbot123@localhost:5432/saasbot
\`\`\`

### Opção 3: PostgreSQL com Docker

Se estiver usando Docker Compose, o banco será criado automaticamente.

\`\`\`bash
# Subir apenas o PostgreSQL
docker-compose up -d postgres

# Verificar se está rodando
docker-compose logs postgres
\`\`\`

O script SQL em `scripts/` será executado automaticamente na primeira inicialização.

---

## 🐳 Deploy com Docker

### Passo 1: Preparar o Ambiente

Certifique-se de que o Docker e Docker Compose estão instalados:

\`\`\`bash
# Verificar Docker
docker --version

# Verificar Docker Compose
docker-compose --version
\`\`\`

### Passo 2: Configurar Variáveis de Ambiente

\`\`\`bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com suas configurações
nano .env
\`\`\`

Configure especialmente:
- `DATABASE_URL` - Se usar banco externo (Neon)
- `JWT_SECRET` - Chave secreta forte
- `CAKTO_WEBHOOK_SECRET` - Secret do webhook

### Passo 3: Build e Inicialização

\`\`\`bash
# Build de todos os serviços
docker-compose build

# Iniciar todos os serviços
docker-compose up -d
\`\`\`

### Passo 4: Verificar Status

\`\`\`bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f frontend
docker-compose logs -f whatsapp-engine
docker-compose logs -f postgres
\`\`\`

### Passo 5: Acessar a Aplicação

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | Dashboard Next.js |
| WhatsApp Engine | http://localhost:3001 | API do WhatsApp |
| PostgreSQL | localhost:5432 | Banco de dados |
| Nginx | http://localhost:80 | Reverse proxy |

### Comandos Docker Úteis

\`\`\`bash
# Parar todos os serviços
docker-compose down

# Parar e remover volumes (CUIDADO: apaga dados!)
docker-compose down -v

# Reiniciar um serviço específico
docker-compose restart frontend

# Acessar terminal de um container
docker exec -it saasbot-frontend sh

# Ver uso de recursos
docker stats
\`\`\`

### Arquitetura dos Serviços Docker

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                         NGINX                                │
│                    (Reverse Proxy)                           │
│                    Porta: 80/443                             │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                ▼                         ▼
┌───────────────────────┐   ┌───────────────────────────────┐
│      FRONTEND         │   │      WHATSAPP ENGINE           │
│     (Next.js)         │   │    (Node.js + Puppeteer)       │
│     Porta: 3000       │   │         Porta: 3001            │
└───────────┬───────────┘   └───────────┬───────────────────┘
            │                           │
            └─────────────┬─────────────┘
                          │
                          ▼
            ┌─────────────────────────────┐
            │        POSTGRESQL           │
            │        Porta: 5432          │
            └─────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────────┐
            │          REDIS              │
            │       (Cache/Filas)         │
            │        Porta: 6379          │
            └─────────────────────────────┘
\`\`\`

---

## ☁️ Deploy na Vercel (Frontend)

A Vercel é a plataforma ideal para hospedar o frontend Next.js.

### Passo 1: Criar Conta na Vercel

1. Acesse [vercel.com](https://vercel.com/)
2. Faça login com sua conta GitHub

### Passo 2: Importar Projeto

1. Clique em "Add New..." > "Project"
2. Selecione o repositório `promolinxy-saas-bot-whatsapp`
3. Clique em "Import"

### Passo 3: Configurar Variáveis de Ambiente

Na tela de configuração do projeto:

1. Expanda "Environment Variables"
2. Adicione as variáveis:

| Nome | Valor |
|------|-------|
| `DATABASE_URL` | Sua connection string do Neon |
| `JWT_SECRET` | Sua chave secreta |
| `CAKTO_WEBHOOK_SECRET` | Secret do webhook Cakto |
| `DEFAULT_TENANT_ID` | `00000000-0000-0000-0000-000000000001` |

### Passo 4: Deploy

1. Clique em "Deploy"
2. Aguarde o build (geralmente 1-2 minutos)
3. Acesse a URL gerada (ex: `seu-projeto.vercel.app`)

### Passo 5: Configurar Domínio Personalizado (Opcional)

1. Vá em "Settings" > "Domains"
2. Adicione seu domínio
3. Configure os DNS conforme instruções

### Configurações Recomendadas

No arquivo `vercel.json` (crie se não existir):

\`\`\`json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
\`\`\`

---

## 📱 Configuração do WhatsApp Engine

O WhatsApp Engine é o serviço responsável pelo envio de mensagens. Ele usa a biblioteca `whatsapp-web.js` com Puppeteer.

### Requisitos Especiais

> ⚠️ **Importante:** O WhatsApp Engine NÃO pode rodar na Vercel devido às dependências do Puppeteer/Chrome. Ele precisa de um servidor VPS dedicado.

### Opção 1: Deploy em VPS

#### Passo 1: Preparar o Servidor

\`\`\`bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências do Chrome
sudo apt install -y \
    chromium-browser \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils
\`\`\`

#### Passo 2: Instalar Docker

\`\`\`bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Reiniciar shell
newgrp docker

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
\`\`\`

#### Passo 3: Clonar e Configurar

\`\`\`bash
# Clonar repositório
git clone https://github.com/kauameloo/promolinxy-saas-bot-whatsapp.git
cd promolinxy-saas-bot-whatsapp

# Configurar ambiente
cp .env.example .env
nano .env
\`\`\`

#### Passo 4: Iniciar com Docker

\`\`\`bash
# Subir apenas o WhatsApp Engine
docker-compose up -d whatsapp-engine

# Ver logs
docker-compose logs -f whatsapp-engine
\`\`\`

### Opção 2: Rodar Localmente (Desenvolvimento)

\`\`\`bash
# Instalar dependências
npm install

# Instalar PM2 globalmente
npm install -g pm2

# Iniciar com PM2
pm2 start ecosystem.config.js

# Ver status
pm2 status

# Ver logs
pm2 logs whatsapp-engine
\`\`\`

### Conectar o WhatsApp

1. Acesse o dashboard: **http://seu-dominio/dashboard/whatsapp**
2. Clique em "Conectar WhatsApp"
3. Escaneie o QR Code com seu WhatsApp
4. Aguarde a conexão ser estabelecida
5. O status mudará para "Conectado" ✅

### Status do WhatsApp

| Status | Descrição |
|--------|-----------|
| `disconnected` | Desconectado |
| `connecting` | Conectando... |
| `qr_ready` | QR Code disponível |
| `connected` | Conectado e pronto |
| `error` | Erro na conexão |

---

## 🔗 Configuração dos Webhooks Cakto

### Passo 1: Acessar Painel da Cakto

1. Faça login no painel da Cakto
2. Vá em **Configurações** > **Integrações** > **Webhooks**

### Passo 2: Adicionar Endpoint

Configure o endpoint:

\`\`\`
URL: https://seu-dominio.com/api/webhooks/cakto
Método: POST
Content-Type: application/json
\`\`\`

### Passo 3: Selecionar Eventos

Marque todos os eventos que deseja receber:

- ✅ `boleto_gerado`
- ✅ `pix_gerado`
- ✅ `picpay_gerado`
- ✅ `openfinance_nubank_gerado`
- ✅ `checkout_abandonment`
- ✅ `purchase_approved`
- ✅ `purchase_refused`

### Passo 4: Configurar Secret (Opcional, mas Recomendado)

1. Gere um secret seguro:
   \`\`\`bash
   openssl rand -hex 32
   \`\`\`
2. Configure na Cakto e no seu `.env`:
   \`\`\`bash
   CAKTO_WEBHOOK_SECRET=seu-secret-gerado
   \`\`\`

### Passo 5: Testar Webhook

Use curl para testar:

\`\`\`bash
curl -X POST https://seu-dominio.com/api/webhooks/cakto \
  -H "Content-Type: application/json" \
  -d '{
    "event": "pix_gerado",
    "transaction_id": "test-123",
    "customer": {
      "name": "Cliente Teste",
      "email": "teste@email.com",
      "phone": "5511999999999"
    },
    "product": {
      "id": "prod-1",
      "name": "Produto Teste",
      "price": 97.00
    },
    "payment": {
      "method": "pix",
      "amount": 97.00,
      "status": "pending",
      "pix_code": "00020126580014br.gov.bcb..."
    }
  }'
\`\`\`

### Verificar no Dashboard

Acesse **Dashboard > Eventos** para ver os webhooks recebidos.

---

## 🔌 Endpoints da API

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/auth/login` | Login do usuário |
| `POST` | `/api/auth/logout` | Logout do usuário |
| `GET` | `/api/auth/me` | Dados do usuário logado |

**Exemplo de Login:**
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@saasbot.com", "password": "admin123"}'
\`\`\`

### Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/dashboard/stats` | Estatísticas gerais |
| `GET` | `/api/dashboard/chart?days=7` | Dados para gráfico |

### Webhooks

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/webhooks/cakto` | Receber eventos da Cakto |
| `GET` | `/api/webhooks/cakto` | Health check |

### Fluxos de Mensagens

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/flows` | Listar fluxos |
| `POST` | `/api/flows` | Criar fluxo |
| `GET` | `/api/flows/:id` | Detalhes do fluxo |
| `PUT` | `/api/flows/:id` | Atualizar fluxo |
| `DELETE` | `/api/flows/:id` | Excluir fluxo |
| `POST` | `/api/flows/:id/messages` | Adicionar mensagem |

### Clientes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/customers` | Listar clientes |
| `GET` | `/api/customers/:id` | Detalhes do cliente |

### Pedidos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/orders` | Listar pedidos |
| `GET` | `/api/orders/:id` | Detalhes do pedido |

### Eventos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/events` | Listar eventos recebidos |

### Logs

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/logs` | Logs de mensagens |

### WhatsApp

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/whatsapp/status` | Status da sessão |
| `POST` | `/api/whatsapp/connect` | Iniciar conexão |
| `POST` | `/api/whatsapp/disconnect` | Desconectar |
| `GET` | `/api/whatsapp/qrcode` | Obter QR Code |

---

## 📊 Guia de Uso do Dashboard

### Login

1. Acesse `http://seu-dominio.com`
2. Entre com suas credenciais:
   - **Email:** `admin@saasbot.com`
   - **Senha:** `admin123`

### Página Principal (Dashboard)

Visão geral com:
- 📨 Total de mensagens enviadas
- ✅ Mensagens entregues
- ❌ Mensagens com falha
- 👥 Total de clientes
- 📦 Total de pedidos
- 📈 Taxa de conversão
- 💰 Receita total
- 📱 Status do WhatsApp

### Fluxos de Mensagens

1. Vá em **Fluxos** no menu lateral
2. Clique em **Novo Fluxo**
3. Configure:
   - Nome do fluxo
   - Tipo de evento (ex: `pix_gerado`)
   - Descrição
4. Adicione mensagens:
   - Conteúdo da mensagem
   - Delay em minutos
   - Ordem de envio

### Variáveis Disponíveis nas Mensagens

Use estas variáveis nos templates:

| Variável | Descrição |
|----------|-----------|
| `{{nome}}` | Nome do cliente |
| `{{produto}}` | Nome do produto |
| `{{preco}}` | Preço formatado |
| `{{link_boleto}}` | Link do boleto |
| `{{qr_code}}` | Código PIX |
| `{{link_checkout}}` | Link do checkout |

**Exemplo de Mensagem:**
\`\`\`
Olá {{nome}}! 👋

Seu PIX do *{{produto}}* está pronto!

Valor: *{{preco}}*

Código PIX:
\`\`\`
{{qr_code}}
\`\`\`

Copie e cole no seu banco! 🚀
\`\`\`

### Clientes

Veja todos os clientes cadastrados:
- Nome e contato
- Pedidos realizados
- Histórico de mensagens

### Pedidos

Acompanhe pedidos:
- Status do pagamento
- Produto e valor
- Cliente associado

### Eventos

Veja todos os webhooks recebidos:
- Tipo de evento
- Data/hora
- Status de processamento

### Logs

Histórico de mensagens enviadas:
- Número de destino
- Conteúdo
- Status de entrega

### WhatsApp

Gerencie a conexão:
- Ver QR Code
- Status em tempo real
- Desconectar/Reconectar

---

## 📈 Monitoramento e Logs

### Logs do Docker

\`\`\`bash
# Todos os serviços
docker-compose logs -f

# Frontend
docker-compose logs -f frontend

# WhatsApp Engine
docker-compose logs -f whatsapp-engine

# PostgreSQL
docker-compose logs -f postgres
\`\`\`

### Logs do PM2

\`\`\`bash
# Ver todos os logs
pm2 logs

# Logs específicos
pm2 logs whatsapp-engine
pm2 logs message-queue

# Monitorar em tempo real
pm2 monit
\`\`\`

### Logs do Sistema

Os logs são salvos em:
- `./logs/whatsapp-error.log` - Erros do WhatsApp
- `./logs/whatsapp-out.log` - Output do WhatsApp
- `./logs/queue-error.log` - Erros da fila
- `./logs/queue-out.log` - Output da fila

### Verificar Saúde dos Serviços

\`\`\`bash
# Health check via curl
curl http://localhost/health

# Status do WhatsApp
curl http://localhost:3000/api/whatsapp/status
\`\`\`

---

## 💾 Backup e Recuperação

### Backup do PostgreSQL

#### Backup Manual

\`\`\`bash
# Criar backup
docker exec saasbot-postgres pg_dump -U saasbot saasbot > backup_$(date +%Y%m%d_%H%M%S).sql

# Ou se estiver usando PostgreSQL local
pg_dump -U saasbot saasbot > backup_$(date +%Y%m%d_%H%M%S).sql
\`\`\`

#### Backup Automático (Cron)

\`\`\`bash
# Criar script de backup
cat > /opt/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/backup
DATE=$(date +%Y%m%d_%H%M%S)
docker exec saasbot-postgres pg_dump -U saasbot saasbot > $BACKUP_DIR/saasbot_$DATE.sql
gzip $BACKUP_DIR/saasbot_$DATE.sql
# Remove backups com mais de 7 dias
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup.sh

# Agendar no cron (backup às 2h da manhã)
echo "0 2 * * * /opt/backup.sh" | crontab -
\`\`\`

### Restaurar Backup

\`\`\`bash
# Restaurar backup
docker exec -i saasbot-postgres psql -U saasbot saasbot < backup_20240101_120000.sql

# Ou se estiver comprimido
gunzip -c backup_20240101_120000.sql.gz | docker exec -i saasbot-postgres psql -U saasbot saasbot
\`\`\`

### Backup das Sessões WhatsApp

\`\`\`bash
# As sessões são salvas no volume
docker cp saasbot-whatsapp:/app/sessions ./sessions_backup
\`\`\`

---

## ❓ Troubleshooting

### Problema: "Erro interno do servidor" ao fazer login

**Causa:** Incompatibilidade de hash de senha entre banco de dados e aplicação.

**Solução:**

Se você recebeu um erro 500 ao tentar fazer login com as credenciais padrão (`admin@saasbot.com` / `admin123`), execute esta correção:

\`\`\`bash
# Se usando Neon Database:
# 1. Vá ao SQL Editor no dashboard do Neon
# 2. Execute o seguinte SQL:
UPDATE users 
SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
WHERE email = 'admin@saasbot.com';

# Ou use o script de migração fornecido:
# No SQL Editor do Neon, cole e execute o conteúdo do arquivo:
# scripts/002-fix-admin-password-hash.sql

# Se usando PostgreSQL local:
psql -U saasbot -d saasbot -f scripts/002-fix-admin-password-hash.sql
\`\`\`

**Nota:** Esta correção atualiza o hash da senha do admin de bcrypt para SHA256, que é o formato usado pela aplicação.

### Problema: "DATABASE_URL not set"

**Causa:** Variável de ambiente não configurada.

**Solução:**
\`\`\`bash
# Verificar se o .env existe
cat .env

# Se não existir, criar
cp .env.example .env
nano .env
\`\`\`

### Problema: "Connection refused" ao conectar no PostgreSQL

**Causa:** PostgreSQL não está rodando ou porta bloqueada.

**Solução:**
\`\`\`bash
# Docker
docker-compose up -d postgres
docker-compose logs postgres

# Local
sudo systemctl start postgresql
sudo systemctl status postgresql
\`\`\`

### Problema: QR Code não aparece

**Causa:** WhatsApp Engine não está rodando corretamente.

**Solução:**
\`\`\`bash
# Ver logs do WhatsApp Engine
docker-compose logs -f whatsapp-engine

# Reiniciar serviço
docker-compose restart whatsapp-engine
\`\`\`

### Problema: Mensagens não estão sendo enviadas

**Causa:** WhatsApp desconectado ou fila parada.

**Solução:**
1. Verifique status no dashboard
2. Reconecte o WhatsApp se necessário
3. Verifique logs da fila:
   \`\`\`bash
   pm2 logs message-queue
   \`\`\`

### Problema: Webhook não está recebendo eventos

**Causa:** URL incorreta ou firewall bloqueando.

**Solução:**
1. Verifique se a URL está acessível:
   \`\`\`bash
   curl -X GET https://seu-dominio.com/api/webhooks/cakto
   \`\`\`
2. Verifique configuração na Cakto
3. Verifique logs do Nginx:
   \`\`\`bash
   docker-compose logs nginx
   \`\`\`

### Problema: Build falha na Vercel

**Causa:** Variáveis de ambiente faltando ou erro de tipagem.

**Solução:**
1. Verifique variáveis de ambiente na Vercel
2. Rode build localmente para ver erros:
   \`\`\`bash
   npm run build
   \`\`\`

### Problema: "Invalid signature" no webhook

**Causa:** Secret não confere.

**Solução:**
1. Verifique se o secret na Cakto é igual ao `.env`
2. Regenere o secret se necessário

---

## 🔒 Segurança

### Boas Práticas

1. **JWT_SECRET**
   - Use no mínimo 64 caracteres (256 bits)
   - Gere com: `openssl rand -base64 64`
   - Nunca compartilhe ou commite
   - Mude em produção

2. **Senhas do Banco**
   - Use senhas fortes
   - Nunca use valores padrão em produção

3. **HTTPS**
   - Sempre use HTTPS em produção
   - Configure SSL/TLS no Nginx

4. **Webhooks**
   - Configure secret para validação
   - Verifique assinatura de todos os requests

5. **Acesso ao Servidor**
   - Use chaves SSH (não senhas)
   - Configure firewall (UFW)
   - Mantenha sistema atualizado

### Configurar SSL com Certbot

\`\`\`bash
# Instalar Certbot
sudo apt install certbot

# Obter certificado
sudo certbot certonly --standalone -d seu-dominio.com

# Copiar certificados para Docker
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem ./docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem ./docker/ssl/key.pem
\`\`\`

### Configurar Firewall

\`\`\`bash
# Instalar UFW
sudo apt install ufw

# Configurar regras
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Ativar firewall
sudo ufw enable
\`\`\`

---

## ❓ FAQ - Perguntas Frequentes

### 1. Posso usar o projeto gratuitamente?

Sim! O projeto usa tecnologias com tiers gratuitos:
- **Vercel**: Tier gratuito generoso
- **Neon**: 500MB gratuito
- **VPS**: A partir de $5/mês para WhatsApp Engine

### 2. Quantas mensagens posso enviar?

Depende dos limites do WhatsApp. Recomendamos:
- Não exceder 200 mensagens/hora
- Respeitar horários comerciais
- Não enviar spam

### 3. O WhatsApp pode banir meu número?

Sim, se violar os termos de uso. Para evitar:
- Use apenas para mensagens de valor (recuperação de vendas)
- Não faça spam
- Permita opt-out

### 4. Posso usar com outras plataformas além da Cakto?

Sim! O sistema é extensível. Basta criar novos endpoints de webhook.

### 5. Como escalar para mais mensagens?

- Use múltiplas instâncias do WhatsApp Engine
- Configure Redis para filas
- Use múltiplos números de WhatsApp

### 6. Como adicionar novos usuários?

Atualmente via banco de dados:
\`\`\`sql
INSERT INTO users (tenant_id, email, password_hash, name, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'novo@email.com',
  '$2b$10$...', -- Hash bcrypt da senha
  'Novo Usuário',
  'user'
);
\`\`\`

### 7. O projeto suporta multi-tenancy?

Sim! A arquitetura está pronta. Cada tenant tem dados isolados pelo `tenant_id`.

### 8. Como atualizar o projeto?

\`\`\`bash
# Pull das atualizações
git pull origin main

# Reinstalar dependências
npm install

# Rebuild Docker
docker-compose build --no-cache
docker-compose up -d
\`\`\`

---

## 📞 Suporte

Se tiver dúvidas ou problemas:

1. Abra uma issue no GitHub
2. Verifique a documentação
3. Consulte os logs para detalhes do erro

---

## 📄 Licença

MIT License - Veja o arquivo LICENSE para detalhes.

---

**Feito com ❤️ para automatizar suas vendas!**
