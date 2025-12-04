# Guia Rápido: Verificando Dados dos Webhooks

## Problema: "Não estou vendo nome do cliente ou valores"

### Passo 1: Verifique os Logs do Servidor

```bash
# Se estiver usando Docker
docker-compose logs -f frontend | grep "CAKTO WEBHOOK"

# Ou logs gerais
docker-compose logs -f frontend
```

**O que procurar:**
```
=== CAKTO WEBHOOK RECEIVED ===
Event Type: pix_gerado
Transaction ID: TRX-123
Customer Data: {
  "name": "João Silva",      ← Nome do cliente
  "email": "joao@email.com", ← Email do cliente
  "phone": "5511999999999"   ← Telefone
}
Product Data: {
  "name": "Curso XYZ",       ← Nome do produto
  "price": 497               ← Valor do produto
}
Payment Data: {
  "amount": 497,             ← Valor do pagamento
  ...
}
```

### Passo 2: Verifique no Banco de Dados

```bash
# Conecte ao PostgreSQL
docker-compose exec postgres psql -U saasbot -d saasbot
```

**Verifique os clientes:**
```sql
SELECT id, name, email, phone, created_at 
FROM customers 
ORDER BY created_at DESC 
LIMIT 10;
```

**Verifique os pedidos:**
```sql
SELECT id, product_name, amount, payment_method, status, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;
```

**Verifique os eventos de webhook:**
```sql
SELECT 
  id, 
  event_type, 
  processed, 
  payload->>'customer' as customer_data,
  payload->>'product' as product_data,
  created_at 
FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 5;
```

### Passo 3: Verifique as Mensagens Variáveis

Procure nos logs por:
```
Message variables for flow: {
  nome: "João Silva",        ← Nome disponível?
  email: "joao@email.com",   ← Email disponível?
  produto: "Curso XYZ",      ← Produto disponível?
  preco: "R$ 497,00",        ← Preço formatado?
  ...
}
```

Se aparecer `(empty)`, significa que o dado não veio no webhook.

### Passo 4: Teste com Payload Completo

Use o script de teste:

```bash
/tmp/test-webhooks.sh
```

Isso enviará webhooks de teste com TODOS os campos preenchidos.

## Diagnóstico de Problemas Comuns

### ⚠️ "No customer phone found"
**Causa:** O webhook não enviou o campo `customer.phone`  
**Solução:** Verifique a configuração na Cakto ou contate o suporte

### ⚠️ "No customer available - skipping message scheduling"
**Causa:** Cliente não foi criado (geralmente por falta de telefone)  
**Solução:** Certifique-se que `customer.phone` está presente no payload

### Variáveis vazias tipo `{{nome}}`
**Causa:** O campo `customer.name` não veio no webhook  
**Solução:** 
1. Verifique se a Cakto está enviando o campo
2. Veja o log "CAKTO WEBHOOK RECEIVED" para confirmar
3. Se não estiver vindo, configure na Cakto

### Valores R$ 0,00
**Causa:** Nem `payment.amount` nem `product.price` foram enviados  
**Solução:** Verifique se ao menos um desses campos está no webhook

## Exemplo de Webhook COMPLETO

```json
{
  "transaction_id": "TRX-12345",
  "customer": {
    "name": "João da Silva",
    "email": "joao@email.com",
    "phone": "5511987654321",
    "document": "12345678900"
  },
  "product": {
    "id": "PROD-001",
    "name": "Curso Completo",
    "price": 497.00
  },
  "payment": {
    "method": "pix",
    "amount": 497.00,
    "status": "pending",
    "pix_code": "00020126...",
    "checkout_url": "https://..."
  },
  "metadata": {
    "source": "landing_page"
  },
  "timestamp": "2024-12-04T03:00:00Z"
}
```

## Checklist de Verificação

- [ ] Os logs mostram "CAKTO WEBHOOK RECEIVED"?
- [ ] O campo `Customer Data` está preenchido nos logs?
- [ ] O campo `Product Data` está preenchido nos logs?
- [ ] O campo `Payment Data` contém `amount`?
- [ ] O cliente aparece na tabela `customers`?
- [ ] O pedido aparece na tabela `orders` com valores?
- [ ] As mensagens variáveis mostram os dados ou "(empty)"?

## Suporte

Para mais detalhes, consulte:
- [Documentação Completa de Webhooks](./WEBHOOK_DATA_CAPTURE.md)
- [Setup Inicial](./SETUP.md)
- Logs do sistema: `docker-compose logs -f`
