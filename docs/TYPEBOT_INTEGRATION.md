# Integração Typebot - WhatsApp Engine

Este documento descreve a integração completa entre o WhatsApp Engine (whatsapp-web.js) e o Typebot self-hosted.

## Arquitetura

\`\`\`
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WhatsApp      │────▶│  WhatsApp       │────▶│   Typebot       │
│   Usuário       │     │  Engine         │     │   Viewer        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        │
                        ┌─────────────────┐             │
                        │     Redis       │◀────────────┘
                        │   (Sessões)     │
                        └─────────────────┘
\`\`\`

## Módulos Criados

### 1. `src/backend/integrations/typebotClient.ts`
Cliente HTTP para comunicação com a API do Typebot.

**Responsabilidades:**
- Montar chamadas HTTP ao Typebot com API key
- `startChat()` - Iniciar nova conversa
- `continueChat()` - Continuar conversa existente
- `parseMessages()` - Converter respostas do Typebot para formato WhatsApp

### 2. `src/backend/integrations/redisSession.ts`
Gerenciamento de sessões Typebot via Redis.

**Responsabilidades:**
- Key pattern: `typebot:session:<phone>`
- Conteúdo: `{ sessionId, flowId, lastUsedAt, phoneNumber }`
- TTL: 72 horas (configurável)
- Identificar sessão nova ou existente

### 3. `src/backend/integrations/typebotBridge.ts`
Ponte principal entre WhatsApp e Typebot.

**Responsabilidades:**
- Receber texto do usuário via WhatsApp
- Descobrir se é start ou continue (via Redis)
- Acionar typebotClient
- Converter respostas do Typebot em mensagens WhatsApp
- Suportar botões/opções

## Fluxo de Mensagens

### WhatsApp → Typebot

1. Usuário envia mensagem no WhatsApp
2. `whatsapp-server.ts` recebe via `onMessage` callback
3. Mensagem é passada para `typebotBridge.processIncomingMessage()`
4. Bridge verifica sessão no Redis:
   - Se não existe → `typebotClient.startChat()`
   - Se existe → `typebotClient.continueChat()`
5. Sessão é salva/atualizada no Redis
6. Respostas do Typebot são parseadas e enviadas via WhatsApp

### Typebot → WhatsApp

O bridge suporta os seguintes tipos de resposta:

| Tipo Typebot | Ação no WhatsApp |
|--------------|------------------|
| `text` | Mensagem de texto simples |
| `image` | Envio de imagem via URL |
| `video` | Envio de vídeo via URL |
| `audio` | Envio de áudio via URL |
| `file` | Envio de documento via URL |
| `choice input` | Botões ou lista numerada |

### Regra de Botões

- **Até 3 opções**: Tenta usar botões nativos do WhatsApp (pode não funcionar em todas as contas)
- **Mais de 3 opções**: Envia lista numerada

Exemplo de lista numerada:
\`\`\`
Escolha uma opção:

1) Opção A
2) Opção B
3) Opção C
4) Opção D

_Responda com o número ou texto da opção desejada._
\`\`\`

O usuário pode responder com o número (1, 2, 3...) ou com o texto exato da opção.

## Configuração

### Variáveis de Ambiente

\`\`\`env
# Typebot Configuration
TYPEBOT_BASE_URL=http://typebot-viewer:3000
TYPEBOT_DEFAULT_FLOW_ID=xezayzvvqcp5cg51lp3mgn67
TYPEBOT_API_KEY=eeSGYZB7KF1plYGgWFQUAtk9
TYPEBOT_SESSION_TTL_HOURS=72

# Redis Configuration
REDIS_URL=redis://redis:6379
\`\`\`

## APIs Disponíveis

### POST /api/typebot/reset-session
Reseta a sessão Typebot de um usuário.

**Body:**
\`\`\`json
{
  "phone": "5511999999999"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Session reset successfully",
  "phone": "5511999999999"
}
\`\`\`

### GET /api/typebot/session/:phone
Obtém informações da sessão de um usuário.

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "flowId": "xezayzvvqcp5cg51lp3mgn67",
    "lastUsedAt": "2024-01-15T10:30:00.000Z",
    "phoneNumber": "5511999999999"
  }
}
\`\`\`

### GET /api/typebot/sessions
Lista todas as sessões ativas.

**Response:**
\`\`\`json
{
  "success": true,
  "data": ["typebot:session:5511999999999", "typebot:session:5511888888888"],
  "count": 2
}
\`\`\`

## Resetar Sessão via Redis CLI

Para resetar manualmente uma sessão Typebot:

\`\`\`bash
# Conectar ao Redis
docker exec -it redis redis-cli

# Listar todas as sessões Typebot
KEYS typebot:session:*

# Ver dados de uma sessão específica
GET typebot:session:5511999999999

# Ver TTL restante
TTL typebot:session:5511999999999

# Deletar uma sessão específica
DEL typebot:session:5511999999999

# Deletar TODAS as sessões Typebot
DEL $(redis-cli KEYS "typebot:session:*" | xargs)
\`\`\`

## Testando a Integração

### 1. Verificar Health Check
\`\`\`bash
curl http://localhost:3001/health
\`\`\`

Resposta esperada:
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "typebotBridgeActive": true
}
\`\`\`

### 2. Verificar Sessões Ativas
\`\`\`bash
curl http://localhost:3001/api/typebot/sessions
\`\`\`

### 3. Testar Fluxo Completo
1. Conecte o WhatsApp via dashboard
2. Envie uma mensagem de qualquer número para o WhatsApp conectado
3. Verifique os logs do servidor para ver o processamento
4. O Typebot deve responder automaticamente

## Logs de Debug

O sistema gera logs detalhados para debug:

\`\`\`
[TypebotClient] Iniciando chat - Flow: xezayzvvqcp5cg51lp3mgn67
[TypebotClient] Chat iniciado - Session ID: abc123, Mensagens: 3
[RedisSession] Sessão salva para 5511999999999: abc123 (TTL: 72h)
[TypebotBridge] Processando mensagem de 5511999999999: Olá...
[TypebotBridge] Mensagens a enviar: 2
[TypebotBridge] Processamento concluído: 2 mensagens enviadas, 0 erros
\`\`\`

## Troubleshooting

### Erro: "TypebotBridge not initialized"
- Verifique se o Redis está acessível
- Verifique as variáveis de ambiente do Typebot

### Erro: "SESSION_EXPIRED"
- A sessão expirou no Typebot
- O sistema automaticamente cria uma nova sessão

### Mensagens não chegam no Typebot
- Verifique se o WhatsApp está conectado
- Verifique se não é mensagem de grupo (grupos são ignorados)
- Verifique os logs do servidor

### Botões não funcionam
- Botões nativos do WhatsApp têm suporte limitado
- O sistema usa lista numerada como fallback
- Usuário pode responder com número ou texto
\`\`\`

```plaintext file=".env.typebot.example"
# =====================================================
# TYPEBOT INTEGRATION - Environment Variables
# =====================================================
# Copie este arquivo para .env ou adicione estas variáveis
# ao seu docker-compose na VPS

# Typebot Viewer URL (interno na rede Docker)
TYPEBOT_BASE_URL=http://typebot-viewer:3000

# ID do fluxo padrão do Typebot
TYPEBOT_DEFAULT_FLOW_ID=xezayzvvqcp5cg51lp3mgn67

# API Key do Typebot
TYPEBOT_API_KEY=eeSGYZB7KF1plYGgWFQUAtk9

# Tempo de vida da sessão em horas (padrão: 72)
TYPEBOT_SESSION_TTL_HOURS=72

# Redis URL (interno na rede Docker)
REDIS_URL=redis://redis:6379
