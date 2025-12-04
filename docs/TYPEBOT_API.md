# TypeBot Bridge - API Documentation

## Overview

This document describes the API endpoints for the TypeBot Bridge integration.

All endpoints require authentication via JWT token in the request headers.

## Base URL

Backend server: `http://localhost:3001` (development)
Frontend proxy: `/api/proxy/api/typebot` (production)

## Authentication

Include JWT token in headers:

```http
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. List TypeBot Flows

Get all TypeBot flows for a tenant.

**Endpoint**: `GET /api/typebot/flows/:tenantId`

**Parameters**:
- `tenantId` (path) - UUID of the tenant

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "name": "My TypeBot Flow",
      "flow_url": "https://bot.promolinxy.online/chatbot",
      "token": "dFFZwBGJE2gQuXLcnVyXYpfj",
      "is_active": true,
      "settings": {
        "preferReupload": true,
        "enableUrlRewrite": false,
        "delays": {
          "fixed": 1000,
          "perMessage": 500,
          "random": { "min": 200, "max": 800 }
        }
      },
      "created_at": "2025-12-04T10:00:00Z",
      "updated_at": "2025-12-04T10:00:00Z"
    }
  ]
}
```

### 2. Create TypeBot Flow

Create a new TypeBot flow configuration.

**Endpoint**: `POST /api/typebot/flows/:tenantId`

**Parameters**:
- `tenantId` (path) - UUID of the tenant

**Request Body**:
```json
{
  "name": "My TypeBot Flow",
  "flowUrl": "https://bot.promolinxy.online/chatbot",
  "token": "dFFZwBGJE2gQuXLcnVyXYpfj",
  "settings": {
    "preferReupload": true,
    "enableUrlRewrite": false,
    "delays": {
      "fixed": 1000,
      "perMessage": 500,
      "random": { "min": 200, "max": 800 }
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "name": "My TypeBot Flow",
    "flow_url": "https://bot.promolinxy.online/chatbot",
    "token": "dFFZwBGJE2gQuXLcnVyXYpfj",
    "is_active": true,
    "settings": { /* ... */ },
    "created_at": "2025-12-04T10:00:00Z",
    "updated_at": "2025-12-04T10:00:00Z"
  }
}
```

### 3. Update TypeBot Flow

Update an existing TypeBot flow configuration.

**Endpoint**: `PUT /api/typebot/flows/:tenantId/:flowId`

**Parameters**:
- `tenantId` (path) - UUID of the tenant
- `flowId` (path) - UUID of the flow

**Request Body** (all fields optional):
```json
{
  "name": "Updated Flow Name",
  "flowUrl": "https://bot.promolinxy.online/chatbot-v2",
  "token": "new_token",
  "isActive": true,
  "settings": {
    "preferReupload": false,
    "enableUrlRewrite": true,
    "urlRewriteMap": {
      "old-domain.com": "new-domain.com"
    },
    "delays": {
      "fixed": 2000,
      "perMessage": 1000
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "name": "Updated Flow Name",
    /* ... updated fields ... */
    "updated_at": "2025-12-04T11:00:00Z"
  }
}
```

### 4. Delete TypeBot Flow

Delete a TypeBot flow configuration.

**Endpoint**: `DELETE /api/typebot/flows/:tenantId/:flowId`

**Parameters**:
- `tenantId` (path) - UUID of the tenant
- `flowId` (path) - UUID of the flow

**Response**:
```json
{
  "success": true,
  "message": "Flow deleted"
}
```

### 5. Get TypeBot Logs

Retrieve message logs for TypeBot conversations.

**Endpoint**: `GET /api/typebot/logs/:tenantId`

**Parameters**:
- `tenantId` (path) - UUID of the tenant

**Query Parameters**:
- `phone` (optional) - Filter by phone number
- `sessionId` (optional) - Filter by session ID
- `limit` (optional) - Number of logs to return (default: 100, max: 1000)

**Example**:
```
GET /api/typebot/logs/tenant-uuid?phone=+5511999999999&limit=50
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "phone": "+55119***90707",
      "session_id": "session_123",
      "direction": "inbound",
      "content": "Hello",
      "message_type": "text",
      "error_message": null,
      "created_at": "2025-12-04T10:00:00Z"
    },
    {
      "id": "uuid",
      "phone": "+55119***90707",
      "session_id": "session_123",
      "direction": "outbound",
      "content": "Hi! How can I help you?",
      "message_type": "text",
      "error_message": null,
      "created_at": "2025-12-04T10:00:01Z"
    }
  ]
}
```

**Note**: Phone numbers are automatically masked in the response for privacy.

### 6. Test TypeBot Flow

Test a TypeBot flow without sending to WhatsApp.

**Endpoint**: `POST /api/typebot/test/:tenantId`

**Parameters**:
- `tenantId` (path) - UUID of the tenant

**Request Body**:
```json
{
  "phone": "+5511913390707",
  "message": "Hello"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "messageCount": 3,
    "messages": [
      {
        "type": "text",
        "text": "Hello! Welcome to our service."
      },
      {
        "type": "buttons",
        "text": "What would you like to do?",
        "buttons": [
          { "id": "btn1", "label": "Get Started" },
          { "id": "btn2", "label": "Learn More" }
        ]
      },
      {
        "type": "text",
        "text": "Feel free to ask any questions!"
      }
    ],
    "delay": 2500
  }
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### HTTP Status Codes

- `200 OK` - Successful request
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Common Error Messages

| Error | Description | Solution |
|-------|-------------|----------|
| `Missing required fields: ...` | Required fields not provided | Include all required fields |
| `Tenant not found` | Invalid tenant ID | Verify tenant ID is correct |
| `Flow not found` | Invalid flow ID | Verify flow exists |
| `No TypeBot flow configured` | No active flow for tenant | Create and activate a flow |
| `Error fetching flows` | Database or server error | Check logs, retry request |

## Message Types

The TypeBot bridge supports the following message types:

### Text Message

```json
{
  "type": "text",
  "text": "Message content here"
}
```

### Media Message

```json
{
  "type": "media",
  "mediaType": "image|video|audio|document",
  "mediaUrl": "https://example.com/media.jpg",
  "mediaPath": "/tmp/media_123.jpg",
  "caption": "Optional caption"
}
```

**Media Types**:
- `image` - Images (JPEG, PNG, GIF, WebP)
- `video` - Videos (MP4, WebM)
- `audio` - Audio files (MP3, OGG, WAV)
- `document` - Documents (PDF, DOC, etc.)

### Buttons Message

```json
{
  "type": "buttons",
  "text": "Choose an option:",
  "buttons": [
    { "id": "btn1", "label": "Option 1" },
    { "id": "btn2", "label": "Option 2" },
    { "id": "btn3", "label": "Option 3" }
  ]
}
```

**Limits**:
- Maximum 3 buttons per message
- Button labels max 20 characters

### List Message

```json
{
  "type": "list",
  "text": "Please select an option:",
  "title": "Options Menu",
  "buttonText": "Choose",
  "sections": [
    {
      "title": "Section 1",
      "rows": [
        {
          "id": "row1",
          "title": "Option 1",
          "description": "Description of option 1"
        },
        {
          "id": "row2",
          "title": "Option 2"
        }
      ]
    }
  ]
}
```

**Limits**:
- Used for >3 options
- Row titles max 24 characters
- Descriptions max 72 characters

## TypeBot API Integration

### Start Chat

The bridge internally calls TypeBot's start chat endpoint:

```http
POST {flowUrl}/api/v1/typebots/start
Content-Type: application/json
Authorization: Bearer {token}

{
  "isStreamEnabled": false,
  "prefilledVariables": {
    "phone": "+5511999999999",
    "tenantId": "tenant-uuid"
  }
}
```

**Response**:
```json
{
  "sessionId": "session_abc123",
  "messages": [
    {
      "id": "msg1",
      "type": "text",
      "content": {
        "richText": [
          {
            "type": "p",
            "children": [{ "text": "Welcome!" }]
          }
        ]
      }
    }
  ],
  "input": {
    "id": "input1",
    "type": "text",
    "options": {
      "labels": {
        "placeholder": "Type your message..."
      }
    }
  }
}
```

### Continue Chat

```http
POST {flowUrl}/api/v1/sessions/{sessionId}/continueChat
Content-Type: application/json
Authorization: Bearer {token}

{
  "message": "User message here"
}
```

**Response**:
```json
{
  "messages": [
    {
      "id": "msg2",
      "type": "text",
      "content": {
        "richText": [
          {
            "type": "p",
            "children": [{ "text": "Response message" }]
          }
        ]
      }
    }
  ],
  "input": {
    "id": "input2",
    "type": "email",
    "options": {
      "labels": {
        "placeholder": "Enter your email..."
      }
    }
  }
}
```

## Redis Session Structure

Sessions are stored in Redis with the following structure:

### Session Key

```
typebot:session:{phone}
```

**Value** (JSON):
```json
{
  "sessionId": "session_+5511999999999_1733306400000",
  "phone": "+5511999999999",
  "lastActivityAt": "2025-12-04T10:00:00.000Z",
  "lastUserMessage": "Hello",
  "lastOptions": {
    "btn1": "Get Started",
    "btn2": "Learn More"
  },
  "flowUrl": "https://bot.promolinxy.online/chatbot",
  "tenantId": "tenant-uuid"
}
```

**TTL**: 259200 seconds (72 hours)

### Last Options Key

```
typebot:lastOptions:{sessionId}
```

**Value** (JSON):
```json
{
  "btn1": "Get Started",
  "btn2": "Learn More",
  "btn3": "Contact Us"
}
```

### Last Activity Key

```
typebot:lastActivity:{sessionId}
```

**Value**: ISO 8601 timestamp string
```
2025-12-04T10:00:00.000Z
```

## Rate Limiting

The bridge implements basic rate limiting to prevent abuse:

- **Per-user limit**: Configurable via tenant settings
- **Global limit**: Configurable via environment variables
- **Backoff strategy**: Exponential backoff on errors

When rate limited, the response will be:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

**HTTP Status**: `429 Too Many Requests`

## Webhooks

The bridge can trigger webhooks for specific events:

### Event Types

- `message.received` - Inbound message from WhatsApp
- `message.sent` - Outbound message to WhatsApp
- `session.created` - New session started
- `session.expired` - Session expired
- `error.occurred` - Error during processing

### Webhook Payload

```json
{
  "event": "message.received",
  "timestamp": "2025-12-04T10:00:00.000Z",
  "tenantId": "tenant-uuid",
  "data": {
    "phone": "+5511999999999",
    "sessionId": "session_123",
    "message": "Hello",
    "messageType": "text"
  }
}
```

## Best Practices

1. **Always use HTTPS** for production TypeBot URLs
2. **Secure your tokens** - never expose in client-side code
3. **Implement retry logic** for API calls
4. **Monitor logs** regularly for errors
5. **Set appropriate delays** to avoid rate limits
6. **Use media reupload** for reliability
7. **Test flows** before activating
8. **Monitor Redis memory** usage
9. **Set up alerts** for critical errors
10. **Keep sessions alive** by responding within 72 hours

## Examples

### cURL Examples

#### Create a flow
```bash
curl -X POST http://localhost:3001/api/typebot/flows/tenant-uuid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "name": "Customer Support Bot",
    "flowUrl": "https://bot.promolinxy.online/chatbot",
    "token": "dFFZwBGJE2gQuXLcnVyXYpfj",
    "settings": {
      "preferReupload": true,
      "delays": {
        "fixed": 1000,
        "perMessage": 500
      }
    }
  }'
```

#### Get logs
```bash
curl -X GET "http://localhost:3001/api/typebot/logs/tenant-uuid?limit=50" \
  -H "Authorization: Bearer your-jwt-token"
```

#### Test flow
```bash
curl -X POST http://localhost:3001/api/typebot/test/tenant-uuid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "phone": "+5511913390707",
    "message": "Hello"
  }'
```

### JavaScript Examples

```javascript
// Create a flow
const createFlow = async () => {
  const response = await fetch('/api/proxy/api/typebot/flows/tenant-uuid', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'My Flow',
      flowUrl: 'https://bot.promolinxy.online/chatbot',
      token: 'dFFZwBGJE2gQuXLcnVyXYpfj'
    })
  })
  
  return await response.json()
}

// Get logs with filters
const getLogs = async (phone, limit = 100) => {
  const response = await fetch(
    `/api/proxy/api/typebot/logs/tenant-uuid?phone=${phone}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  )
  
  return await response.json()
}
```

## Support

For API support:
- Check the logs for detailed error messages
- Verify all parameters are correct
- Test with curl before implementing in code
- Review this documentation
- Contact support with request/response details
