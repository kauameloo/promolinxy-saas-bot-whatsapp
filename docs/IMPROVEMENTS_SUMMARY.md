# Resumo das Melhorias - Captura de Dados dos Webhooks

## Problema Original

O usuário relatou que estava recebendo webhooks da Cakto, mas:
- Nomes dos clientes não apareciam
- Valores das transações não apareciam
- Não era possível ver todos os detalhes importantes enviados pela Cakto

## Solução Implementada

### 1. Logs Detalhados em Desenvolvimento

**O que foi feito:**
- Adicionado log completo de todos os dados recebidos no webhook
- Log de cada etapa do processamento (cliente, pedido, mensagens)
- Avisos quando dados importantes estão faltando

**Como usar:**
\`\`\`bash
# Os logs detalhados aparecem automaticamente em development
docker-compose logs -f frontend | grep "CAKTO WEBHOOK"
\`\`\`

**Exemplo de log:**
\`\`\`
=== CAKTO WEBHOOK RECEIVED ===
Event Type: pix_gerado
Transaction ID: TRX-12345
Customer Data: {
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "5511999999999",
  "document": "12345678900"
}
Product Data: {
  "id": "PROD-001",
  "name": "Curso de Marketing",
  "price": 497
}
Payment Data: {
  "method": "pix",
  "amount": 497,
  ...
}
\`\`\`

### 2. Logs Seguros em Produção

**O que foi feito:**
- Em produção, logs detalhados são desabilitados por padrão
- Apenas informações essenciais são logadas (tipo de evento, ID da transação)
- Pode ser habilitado com variável de ambiente quando necessário

**Como ativar em produção (temporariamente):**
\`\`\`bash
# Adicionar ao .env
WEBHOOK_DEBUG_LOG=true
\`\`\`

### 3. Captura Completa de Dados

**O que foi melhorado:**

#### Dados do Cliente:
- ✅ Nome do cliente
- ✅ Email
- ✅ Telefone (essencial para WhatsApp)
- ✅ Documento (CPF/CNPJ)

#### Dados do Pedido:
- ✅ ID da transação
- ✅ Nome do produto
- ✅ ID do produto
- ✅ Valor do produto
- ✅ Valor do pagamento
- ✅ Método de pagamento
- ✅ Status do pagamento

#### Dados de Pagamento (todos os tipos):
- ✅ PIX: `pix_code` OU `pix_qrcode` (aceita ambos)
- ✅ Boleto: `boleto_url`
- ✅ Checkout: `checkout_url`
- ✅ Metadados: salvos no campo `metadata` do pedido

### 4. Atualização Inteligente de Dados

**O que foi melhorado:**
- Sistema não sobrescreve dados válidos com dados vazios
- Atualiza apenas quando há informação nova e válida
- Mantém histórico completo em metadados

**Exemplo:**
\`\`\`typescript
// Antes: poderia sobrescrever email com ""
if (newEmail) customer.email = newEmail

// Depois: só atualiza se for válido e diferente
if (newEmail && newEmail.trim() !== "" && newEmail !== customer.email) {
  updateData.email = newEmail
}
\`\`\`

### 5. Helper Functions

**O que foi adicionado:**
- `getPixCode()`: extrai código PIX de `pix_code` OU `pix_qrcode`
- Evita duplicação de código
- Facilita manutenção

### 6. Variáveis de Mensagem

Todas as variáveis agora são populadas corretamente:

| Variável | Origem | Logs |
|----------|--------|------|
| `{{nome}}` | `customer.name` | ✅ Logado |
| `{{email}}` | `customer.email` | ✅ Logado |
| `{{telefone}}` | `customer.phone` | ✅ Logado |
| `{{produto}}` | `product.name` | ✅ Logado |
| `{{preco}}` | `payment.amount` ou `product.price` | ✅ Logado |
| `{{link_boleto}}` | `payment.boleto_url` | ✅ Logado |
| `{{qr_code}}` | `payment.pix_code` ou `pix_qrcode` | ✅ Logado |
| `{{link_checkout}}` | `payment.checkout_url` | ✅ Logado |

**Exemplo de log de variáveis:**
\`\`\`
Message variables for flow: {
  nome: "João Silva",
  email: "joao@email.com",
  telefone: "5511999999999",
  produto: "Curso de Marketing",
  preco: "R$ 497,00",
  hasLinkBoleto: false,
  hasQrCode: true,
  hasLinkCheckout: true
}
\`\`\`

## Arquivos Modificados

### Core Changes:
1. `lib/services/webhook-service.ts` - Logs e controle de debug
2. `lib/services/customer-service.ts` - Melhor atualização de dados
3. `lib/services/order-service.ts` - Captura completa de payment data
4. `lib/services/message-service.ts` - Logs de variáveis
5. `lib/utils/message-parser.ts` - Helper `getPixCode()`
6. `app/api/webhooks/cakto/[eventType]/route.ts` - Logs de entrada

### Documentação:
7. `docs/WEBHOOK_DATA_CAPTURE.md` - Documentação completa
8. `docs/WEBHOOK_TROUBLESHOOTING.md` - Guia de troubleshooting
9. `.env.example` - Variável `WEBHOOK_DEBUG_LOG`

## Como Verificar se Está Funcionando

### 1. Verificar Logs
\`\`\`bash
docker-compose logs -f frontend | grep "CAKTO\|Customer\|Order\|Message"
\`\`\`

### 2. Verificar Banco de Dados
\`\`\`sql
-- Ver últimos clientes criados com todos os dados
SELECT name, email, phone, document, created_at 
FROM customers 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver últimos pedidos com valores
SELECT product_name, amount, payment_method, status, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver payload completo dos webhooks
SELECT 
  event_type,
  payload->>'customer' as customer_data,
  payload->>'product' as product_data,
  payload->>'payment' as payment_data,
  created_at
FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 5;
\`\`\`

### 3. Testar com Script
\`\`\`bash
# Enviar webhooks de teste com todos os campos
/tmp/test-webhooks.sh
\`\`\`

## Diagnóstico de Problemas

### Sintoma: Nome do cliente não aparece

**Verifique nos logs:**
\`\`\`
Customer Data: {
  "name": "???",  ← deve ter um nome aqui
  ...
}
\`\`\`

**Causa comum:** Cakto não está enviando `customer.name` no webhook

**Solução:** 
1. Verificar configuração na Cakto
2. Se não estiver disponível, o sistema usa "Cliente" como fallback

### Sintoma: Valor R$ 0,00

**Verifique nos logs:**
\`\`\`
Payment Data: {
  "amount": ???,  ← deve ter valor aqui
}
Product Data: {
  "price": ???  ← ou aqui
}
\`\`\`

**Causa comum:** Nem `payment.amount` nem `product.price` foram enviados

**Solução:** Configurar na Cakto para enviar ao menos um desses campos

### Sintoma: Mensagens não estão sendo enviadas

**Verifique nos logs:**
\`\`\`
⚠ No customer phone found in webhook payload
\`\`\`

**Causa:** Falta o campo `customer.phone`

**Solução:** É obrigatório enviar o telefone do cliente

## Segurança

### Dados Sensíveis em Logs

**Em Development:**
- ✅ Todos os dados são logados para facilitar debugging
- Incluindo nomes, emails, valores

**Em Production:**
- ✅ Apenas informações básicas são logadas
- Dados sensíveis NÃO são logados por padrão
- Pode ser habilitado temporariamente com `WEBHOOK_DEBUG_LOG=true`

### Recomendações:

1. **Nunca commit logs de produção** com dados reais
2. **Use `WEBHOOK_DEBUG_LOG=true` apenas temporariamente** em produção
3. **Rotacione logs regularmente** para não acumular dados sensíveis
4. **Em produção, verifique dados no banco**, não nos logs

## Próximos Passos Recomendados

1. **Testar em desenvolvimento** com o script fornecido
2. **Verificar configuração na Cakto** se campos estão faltando
3. **Monitorar logs em produção** para garantir que dados chegam
4. **Consultar documentação** em `docs/WEBHOOK_DATA_CAPTURE.md`

## Suporte

Se ainda tiver problemas:

1. Consulte [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md)
2. Verifique os logs detalhados: `docker-compose logs -f`
3. Verifique o banco de dados com as queries acima
4. Execute o script de teste para validar o sistema
