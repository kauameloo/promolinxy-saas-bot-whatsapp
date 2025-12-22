# Documentação de Webhooks Cakto

## Visão Geral

Este documento detalha a estrutura dos webhooks da Cakto, os dados capturados pelo sistema e como visualizá-los.

## Estrutura do Webhook

### Campos Principais

Todos os webhooks da Cakto seguem esta estrutura base:

\`\`\`typescript
interface CaktoWebhookPayload {
  event: CaktoEventType                // Tipo do evento (obrigatório, vem da URL)
  transaction_id?: string              // ID da transação
  customer?: CustomerData              // Dados do cliente
  product?: ProductData                // Dados do produto
  payment?: PaymentData                // Dados do pagamento
  metadata?: Record<string, unknown>   // Metadados adicionais
  timestamp?: string                   // Timestamp do evento
}
\`\`\`

### Dados do Cliente (customer)

\`\`\`typescript
interface CustomerData {
  name: string        // Nome do cliente (obrigatório)
  email?: string      // Email do cliente
  phone: string       // Telefone (obrigatório para criar fluxos)
  document?: string   // CPF/CNPJ
}
\`\`\`

**Importante:** 
- O telefone é essencial para o envio de mensagens WhatsApp
- Se o telefone não for fornecido, o pedido será criado mas as mensagens não serão agendadas
- O sistema loga um warning quando o telefone está ausente

### Dados do Produto (product)

\`\`\`typescript
interface ProductData {
  id: string      // ID do produto
  name: string    // Nome do produto
  price: number   // Preço do produto
}
\`\`\`

### Dados do Pagamento (payment)

\`\`\`typescript
interface PaymentData {
  method: string           // Método de pagamento (credit_card, pix, boleto, etc)
  amount: number           // Valor do pagamento
  status: string           // Status do pagamento
  boleto_url?: string      // URL do boleto (para eventos boleto_gerado)
  pix_code?: string        // Código PIX Copia e Cola
  pix_qrcode?: string      // QR Code PIX (alternativa ao pix_code)
  checkout_url?: string    // URL do checkout
}
\`\`\`

**Nota:** O sistema aceita tanto `pix_code` quanto `pix_qrcode`. Se ambos estiverem presentes, `pix_code` tem prioridade.

## Eventos Suportados

### 1. purchase_approved
Disparado quando uma compra é aprovada.

**Campos importantes:**
- `customer.name` e `customer.email` - Para boas-vindas
- `product.name` - Para mencionar o produto comprado
- `payment.amount` - Valor da compra

**Ação do sistema:**
- Cria/atualiza cliente
- Cria/atualiza pedido com status "paid"
- **Cancela mensagens pendentes** do mesmo pedido
- Agenda mensagem de boas-vindas

### 2. pix_gerado
Disparado quando um PIX é gerado.

**Campos importantes:**
- `customer.*` - Dados completos do cliente
- `payment.pix_code` ou `payment.pix_qrcode` - Código para pagamento
- `payment.amount` - Valor do PIX

**Ação do sistema:**
- Agenda 2 mensagens: imediata e follow-up em 30 min

### 3. boleto_gerado
Disparado quando um boleto é gerado.

**Campos importantes:**
- `customer.*` - Dados do cliente
- `payment.boleto_url` - Link do boleto
- `payment.amount` - Valor do boleto

**Ação do sistema:**
- Agenda 3 mensagens: imediata, 24h e 48h

### 4. checkout_abandonment
Disparado quando um carrinho é abandonado.

**Campos importantes:**
- `customer.*` - Para recuperação
- `payment.checkout_url` - Link para retornar ao checkout
- `metadata.time_on_page` - Tempo na página (útil para análise)

**Ação do sistema:**
- Agenda 3 mensagens de recuperação: 30min, 3h e 24h

### 5. purchase_refused
Disparado quando uma compra é recusada.

**Campos importantes:**
- `customer.*` - Para contato
- `payment.checkout_url` - Link para tentar novamente
- `metadata.refusal_reason` - Motivo da recusa

**Ação do sistema:**
- Agenda mensagem de apoio com alternativas

### 6. picpay_gerado
Pagamento via PicPay gerado.

### 7. openfinance_nubank_gerado
Pagamento via Nubank OpenFinance gerado.

## Variáveis de Mensagem

As seguintes variáveis são extraídas do webhook e disponibilizadas nos templates:

| Variável | Origem | Exemplo |
|----------|--------|---------|
| `{{nome}}` | `customer.name` | "João da Silva" |
| `{{email}}` | `customer.email` | "joao@email.com" |
| `{{telefone}}` | `customer.phone` | "5511987654321" |
| `{{produto}}` | `product.name` | "Curso de Marketing" |
| `{{preco}}` | `payment.amount` ou `product.price` | "R$ 497,00" |
| `{{link_boleto}}` | `payment.boleto_url` | "https://..." |
| `{{qr_code}}` | `payment.pix_code` ou `payment.pix_qrcode` | "00020126..." |
| `{{link_checkout}}` | `payment.checkout_url` | "https://..." |
| `{{link_pix}}` | `payment.pix_code` ou `payment.pix_qrcode` | "00020126..." |

## Logs e Debugging

### Logs de Processamento

O sistema agora registra logs detalhados em cada etapa do processamento:

\`\`\`
=== CAKTO WEBHOOK RECEIVED ===
Event Type: pix_gerado
Transaction ID: TRX-67890-TEST
Customer Data: {
  "name": "Maria Santos",
  "email": "maria.santos@email.com",
  "phone": "5521912345678",
  "document": "98765432100"
}
Product Data: {
  "id": "PROD-002",
  "name": "Mentoria Individual 3 Meses",
  "price": 1997
}
Payment Data: {
  "method": "pix",
  "amount": 1997,
  "status": "pending",
  "pix_code": "00020126...",
  "checkout_url": "https://checkout.cakto.com/pix/xyz789"
}
==============================
Creating/updating customer with data: {...}
✓ Customer processed: Maria Santos (uuid)
Creating/updating order with data: {...}
✓ Order processed: uuid
Found 1 active flow(s) for event pix_gerado
Message variables for flow: {
  nome: "Maria Santos",
  email: "maria.santos@email.com",
  telefone: "5521912345678",
  produto: "Mentoria Individual 3 Meses",
  preco: "R$ 1.997,00",
  hasLinkBoleto: false,
  hasQrCode: true,
  hasLinkCheckout: true
}
  → Message scheduled for 2024-12-04T03:15:00Z (delay: 0min)
  → Message scheduled for 2024-12-04T03:45:00Z (delay: 30min)
✓ Scheduled 2 message(s) from flow "PIX Gerado - Conversão Rápida"
✓ Webhook uuid processed successfully
\`\`\`

### Avisos e Erros

O sistema emite avisos quando dados importantes estão ausentes:

- `⚠ No customer phone found in webhook payload` - Telefone não fornecido
- `⚠ No customer available - skipping message scheduling` - Cliente não criado

### Verificando Dados no Dashboard

1. **Eventos recebidos:** `/dashboard/events`
   - Mostra todos os webhooks recebidos
   - Exibe o payload completo em JSON

2. **Clientes:** `/dashboard/customers`
   - Lista clientes com nome, email, telefone
   - Mostra documento (CPF/CNPJ) quando disponível

3. **Pedidos:** `/dashboard/orders`
   - Lista pedidos com produto, valor, status
   - Mostra método de pagamento e links

4. **Logs de mensagens:** `/dashboard/logs`
   - Mostra mensagens enviadas
   - Exibe conteúdo processado com variáveis substituídas

## Testando Webhooks

### Via Script de Teste

Use o script fornecido em `/tmp/test-webhooks.sh`:

\`\`\`bash
# Definir a URL base (padrão: http://localhost:3000)
export WEBHOOK_BASE_URL=http://localhost:3000

# Executar testes
/tmp/test-webhooks.sh
\`\`\`

### Via cURL Manual

\`\`\`bash
curl -X POST http://localhost:3000/api/webhooks/cakto/pix_gerado \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "transaction_id": "TEST-123",
    "customer": {
      "name": "Teste",
      "email": "teste@email.com",
      "phone": "5511999999999"
    },
    "product": {
      "id": "PROD-TEST",
      "name": "Produto Teste",
      "price": 100.00
    },
    "payment": {
      "method": "pix",
      "amount": 100.00,
      "status": "pending",
      "pix_code": "00020126...",
      "checkout_url": "https://..."
    }
  }'
\`\`\`

## Configuração na Cakto

1. Acesse o painel da Cakto
2. Vá em **Configurações > Webhooks**
3. Configure os endpoints:
   - URL base: `https://seu-dominio.com/api/webhooks/cakto/`
   - Um endpoint por tipo de evento:
     - `https://seu-dominio.com/api/webhooks/cakto/purchase_approved`
     - `https://seu-dominio.com/api/webhooks/cakto/pix_gerado`
     - `https://seu-dominio.com/api/webhooks/cakto/boleto_gerado`
     - etc.
4. (Opcional) Configure o webhook secret na variável `CAKTO_WEBHOOK_SECRET`

## Troubleshooting

### Webhook não aparece no dashboard

1. Verifique os logs do servidor: `docker-compose logs -f frontend`
2. Verifique se o evento está na tabela: `SELECT * FROM webhook_events;`
3. Verifique se o payload está válido segundo o schema Zod

### Cliente não está sendo criado

- Verifique se `customer.phone` está presente no payload
- O telefone deve conter apenas números ou ser formatável
- Veja o log: `⚠ No customer phone found`

### Mensagens não estão sendo agendadas

1. Verifique se há fluxos ativos para o tipo de evento
2. Verifique se o cliente foi criado com sucesso
3. Consulte: `SELECT * FROM scheduled_messages WHERE status = 'pending';`

### Variáveis aparecem vazias nas mensagens

- Verifique o log "Message variables for flow" 
- Campos vazios aparecem como "(empty)" no log
- Certifique-se que os dados estão no payload do webhook

## Melhorias Implementadas

1. **Logging detalhado:** Todos os dados recebidos são logados
2. **Captura de pix_qrcode:** Sistema aceita tanto `pix_code` quanto `pix_qrcode`
3. **Metadados enriquecidos:** `payment.status`, `event_type` e `timestamp` são salvos
4. **Avisos informativos:** Sistema avisa quando dados importantes estão ausentes
5. **Logs de variáveis:** Mostra quais variáveis estão disponíveis para cada mensagem
