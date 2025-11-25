# SaaS Bot WhatsApp

Sistema completo de automação WhatsApp com integração Cakto para recuperação de vendas.

## Funcionalidades

- **Webhooks Cakto**: Recebe e processa eventos de pagamento
- **Fluxos Automatizados**: Mensagens sequenciais personalizadas
- **Dashboard**: Interface moderna para gerenciamento
- **Multi-tenancy**: Arquitetura pronta para SaaS
- **WhatsApp Engine**: Envio automatizado de mensagens

## Eventos Suportados

| Evento | Descrição |
|--------|-----------|
| `boleto_gerado` | Boleto gerado para pagamento |
| `pix_gerado` | PIX gerado para pagamento |
| `picpay_gerado` | PicPay gerado para pagamento |
| `openfinance_nubank_gerado` | Nubank OpenFinance |
| `checkout_abandonment` | Abandono de carrinho |
| `purchase_approved` | Compra aprovada |
| `purchase_refused` | Compra recusada |

## Instalação Rápida

### 1. Clone o repositório

\`\`\`bash
git clone https://github.com/seu-usuario/saasbot-whatsapp.git
cd saasbot-whatsapp
\`\`\`

### 2. Configure as variáveis de ambiente

\`\`\`bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
\`\`\`

### 3. Inicie com Docker

\`\`\`bash
docker-compose up -d
\`\`\`

### 4. Execute as migrações

\`\`\`bash
# O script SQL é executado automaticamente pelo Docker
# Ou execute manualmente:
psql $DATABASE_URL -f scripts/001-create-database-schema.sql
\`\`\`

### 5. Acesse o dashboard

- URL: http://localhost:3000
- Email: admin@saasbot.com
- Senha: admin123

## Configuração do Webhook Cakto

1. Acesse o painel da Cakto
2. Vá em Configurações > Webhooks
3. Adicione a URL: `https://seu-dominio.com/api/webhooks/cakto`
4. Selecione todos os eventos desejados
5. (Opcional) Configure o secret para validação

## Estrutura do Projeto

\`\`\`
├── app/
│   ├── api/                 # API Routes
│   │   ├── auth/           # Autenticação
│   │   ├── webhooks/       # Webhooks Cakto
│   │   ├── flows/          # Fluxos de mensagens
│   │   └── ...
│   ├── dashboard/          # Páginas do dashboard
│   └── login/              # Página de login
├── components/
│   └── dashboard/          # Componentes do dashboard
├── lib/
│   ├── services/           # Serviços de negócio
│   ├── whatsapp/           # Engine WhatsApp
│   ├── hooks/              # React hooks
│   └── types/              # TypeScript types
├── docker/                 # Configurações Docker
├── scripts/                # Scripts SQL
└── docs/                   # Documentação
\`\`\`

## Variáveis de Mensagem

Use estas variáveis nos templates:

| Variável | Descrição |
|----------|-----------|
| `{{nome}}` | Nome do cliente |
| `{{produto}}` | Nome do produto |
| `{{preco}}` | Preço formatado |
| `{{link_boleto}}` | Link do boleto |
| `{{qr_code}}` | Código PIX |
| `{{link_checkout}}` | Link do checkout |

## API Endpoints

### Webhook Cakto
\`\`\`
POST /api/webhooks/cakto
\`\`\`

### Dashboard Stats
\`\`\`
GET /api/dashboard/stats
GET /api/dashboard/chart?days=7
\`\`\`

### Fluxos
\`\`\`
GET    /api/flows
POST   /api/flows
GET    /api/flows/:id
PUT    /api/flows/:id
DELETE /api/flows/:id
POST   /api/flows/:id/messages
\`\`\`

### Clientes e Pedidos
\`\`\`
GET /api/customers
GET /api/orders
GET /api/logs
GET /api/events
\`\`\`

## Segurança

- Autenticação JWT
- Validação de payload com Zod
- Verificação de assinatura de webhooks
- Rate limiting no Nginx
- HTTPS em produção

## Escalabilidade

O sistema foi projetado para escalar:

- **Multi-tenancy**: Cada tenant tem dados isolados
- **Filas**: Processamento assíncrono de mensagens
- **Docker**: Deploy horizontal fácil
- **Stateless**: Frontend pode escalar horizontalmente

## Licença

MIT License
