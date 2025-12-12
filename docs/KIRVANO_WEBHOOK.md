# Kirvano Webhook Integration

## Overview
This integration adds support for Kirvano platform webhooks alongside the existing Cakto integration. Both integrations operate completely independently without affecting each other.

## Endpoints

### Kirvano Webhook
- **URL**: `/api/webhooks/kirvano`
- **Methods**: 
  - `GET` - Health check
  - `POST` - Receive webhook events

### Cakto Webhook (Existing)
- **URL**: `/api/webhooks/cakto`
- **Methods**: 
  - `GET` - Health check
  - `POST` - Receive webhook events

## Supported Events

### Kirvano Events
1. `order.created` - New order created
2. `order.approved` - Order approved
3. `order.refused` - Order refused
4. `order.refunded` - Order refunded
5. `order.cancelled` - Order cancelled
6. `payment.pending` - Payment pending
7. `payment.approved` - Payment approved
8. `payment.refused` - Payment refused
9. `payment.refunded` - Payment refunded
10. `cart.abandoned` - Shopping cart abandoned

## Event Mapping

Kirvano events are automatically mapped to internal event types:

| Kirvano Event | Internal Event |
|---------------|----------------|
| `order.created` | `checkout_abandonment` |
| `order.approved` | `purchase_approved` |
| `order.refused` | `purchase_refused` |
| `order.refunded` | `purchase_refused` |
| `order.cancelled` | `purchase_refused` |
| `payment.pending` | `pix_gerado` |
| `payment.approved` | `purchase_approved` |
| `payment.refused` | `purchase_refused` |
| `payment.refunded` | `purchase_refused` |
| `cart.abandoned` | `checkout_abandonment` |

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Kirvano Webhook Secret (optional, for signature verification)
KIRVANO_WEBHOOK_SECRET=your_secret_here

# Kirvano API Key (optional, for future API integrations)
KIRVANO_API_KEY=your_api_key_here
```

## Payload Structure

### Basic Payload
```json
{
  "event": "order.approved",
  "order_id": "order-123",
  "transaction_id": "txn-456",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "5511999999999",
    "document": "12345678900"
  },
  "product": {
    "id": "prod-1",
    "name": "Product Name",
    "price": 99.90
  },
  "payment": {
    "method": "credit_card",
    "amount": 99.90,
    "status": "approved",
    "boleto_url": "https://...",
    "pix_code": "00020126...",
    "pix_qrcode": "data:image/png;base64,...",
    "checkout_url": "https://..."
  },
  "metadata": {
    "custom_field": "value"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Nested Payload
The webhook also supports Kirvano's nested structure:

```json
{
  "event": "order.approved",
  "data": {
    "orderId": "order-123",
    "customer": {
      "name": "John Doe",
      "cellphone": "5511999999999"
    },
    "product": {
      "name": "Product Name"
    },
    "amount": 99.90,
    "paymentMethod": "credit_card"
  }
}
```

## Webhook Signature Verification

If you configure `KIRVANO_WEBHOOK_SECRET`, the webhook will verify signatures sent in the `x-kirvano-signature` header.

Example header:
```
x-kirvano-signature: sha256=abc123def456...
```

## Testing

### Health Check
```bash
curl http://localhost:3000/api/webhooks/kirvano
```

Expected response:
```json
{
  "success": true,
  "message": "Kirvano webhook endpoint is active",
  "data": {
    "supportedEvents": [
      "order.created",
      "order.approved",
      ...
    ]
  }
}
```

### Send Test Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks/kirvano \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.approved",
    "order_id": "test-123",
    "customer": {
      "name": "Test Customer",
      "phone": "5511999999999"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Event order.approved processed successfully",
  "data": {
    "eventId": "evt-uuid..."
  }
}
```

## Database Schema

The Kirvano webhooks use the same database tables as Cakto:

- `webhook_events` - Stores all webhook events (with `source` = "kirvano")
- `customers` - Customer data
- `orders` - Order data
- `scheduled_messages` - Scheduled messages from flows

## Message Flows

Message flows can be configured for Kirvano events just like Cakto events:

1. Go to Dashboard → Flows
2. Create a new flow
3. Select a Kirvano event type (e.g., "order.approved")
4. Add messages with variables
5. Activate the flow

Available variables in messages:
- `{{nome}}` - Customer name
- `{{produto}}` - Product name
- `{{preco}}` - Product price
- `{{email}}` - Customer email
- `{{telefone}}` - Customer phone
- `{{link_boleto}}` - Boleto URL
- `{{qr_code}}` - PIX QR code
- `{{link_checkout}}` - Checkout URL

## Logging

Debug logging can be enabled with:
```env
NODE_ENV=development
# or
WEBHOOK_DEBUG_LOG=true
```

This will log detailed information about:
- Received payloads
- Customer creation/updates
- Order creation/updates
- Message scheduling
- Event mapping

## Error Handling

The webhook implements automatic retry logic:
- Failed events are logged in `webhook_events` table
- Up to 3 retry attempts
- Errors are logged with detailed messages

## Architecture

```
Kirvano Platform
    ↓
POST /api/webhooks/kirvano
    ↓
Validation (Zod Schema)
    ↓
Signature Verification (optional)
    ↓
KirvanoWebhookService
    ↓
Event Mapping (Kirvano → Internal)
    ↓
Payload Normalization
    ↓
Customer Creation/Update
    ↓
Order Creation/Update
    ↓
Message Flow Scheduling
    ↓
WhatsApp Message Queue
```

## Independence from Cakto

The Kirvano integration is completely independent:
- Separate route (`/api/webhooks/kirvano`)
- Separate service (`KirvanoWebhookService`)
- Separate event types (`KirvanoEventType`)
- Separate payload structure (`KirvanoWebhookPayload`)
- Separate environment variables
- Separate database records (identified by `source: "kirvano"`)

No Cakto code was modified during this integration.

## Troubleshooting

### Event Not Processing
1. Check database connection (DATABASE_URL)
2. Verify payload structure matches schema
3. Enable debug logging
4. Check `webhook_events` table for errors

### Customer Not Created
1. Ensure customer phone is provided
2. Check phone format (digits only)
3. Review customer creation logs

### Messages Not Sending
1. Verify flow is active
2. Check event type matches
3. Ensure WhatsApp session is connected
4. Review scheduled_messages table

### Signature Verification Failing
1. Verify KIRVANO_WEBHOOK_SECRET is set correctly
2. Check signature header name (`x-kirvano-signature`)
3. Ensure signature algorithm matches (HMAC-SHA256)

## Future Enhancements

Possible improvements:
- Support for more Kirvano event types
- Custom event mapping configuration
- Webhook retry dashboard
- Real-time webhook testing UI
- Webhook analytics and monitoring
