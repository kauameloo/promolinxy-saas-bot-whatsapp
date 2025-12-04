# TypeBot Bridge - Architecture Overview

## System Architecture

The TypeBot Bridge is a bidirectional integration system that connects WhatsApp (via whatsapp-web.js) with TypeBot chatbots.

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│                 │      │                  │      │                 │
│  WhatsApp User  │◄────►│  WhatsApp Web.js │◄────►│  TypeBot Bridge │
│                 │      │                  │      │                 │
└─────────────────┘      └──────────────────┘      └────────┬────────┘
                                                            │
                                                            │
                         ┌──────────────────────────────────┼────────┐
                         │                                  │        │
                         ▼                                  ▼        ▼
                  ┌──────────────┐                   ┌──────────┐  ┌─────────┐
                  │              │                   │          │  │         │
                  │  TypeBot API │                   │  Redis   │  │  DB     │
                  │              │                   │          │  │         │
                  └──────────────┘                   └──────────┘  └─────────┘
```

## Components

### 1. WhatsApp Engine (`src/backend/lib/whatsapp-engine.ts`)

- Manages WhatsApp Web.js client lifecycle
- Handles QR code generation for pairing
- Receives incoming messages from WhatsApp
- Sends outgoing messages to WhatsApp
- Manages session persistence and reconnection

**Responsibilities**:
- Session management
- Message sending/receiving
- Connection state management
- Event handling

### 2. TypeBot Bridge (`src/backend/integrations/typebot-bridge/`)

Core module responsible for the bidirectional integration.

#### 2.1 Redis Client (`redis-client.ts`)

Manages session state in Redis for fast access and persistence.

**Key Features**:
- Session storage with 72-hour TTL
- Last options mapping for button/list responses
- Activity tracking
- Atomic operations

**Data Structures**:
```
typebot:session:{phone}         → Session metadata
typebot:lastOptions:{sessionId} → Button/list option mappings
typebot:lastActivity:{sessionId}→ Last activity timestamp
typebot:state:{sessionId}       → Custom state data
```

#### 2.2 TypeBot Client (`typebot-client.ts`)

HTTP client for TypeBot API communication.

**Methods**:
- `startChat()` - Initialize new conversation
- `continueChat()` - Send user message and get response
- `extractTextFromMessage()` - Parse TypeBot message format
- `extractOptions()` - Extract buttons/list options

**Features**:
- Automatic retry on network errors
- Request/response logging
- Authentication token management
- Message format parsing

#### 2.3 Message Mapper (`message-mapper.ts`)

Converts TypeBot messages to WhatsApp-compatible format.

**Mapping Rules**:
- `text` → WhatsApp text message
- `image/video/audio` → WhatsApp media message
- `embed` → Download and reupload as media
- `≤3 options` → WhatsApp buttons
- `>3 options` → WhatsApp list
- `input` → Instructional text message

**Features**:
- Media reupload (download → temp file → upload)
- URL rewriting with regex patterns
- Button/list formatting
- Caption handling

#### 2.4 Bridge Controller (`bridge.ts`)

Orchestrates the bidirectional communication flow.

**Flow**:
1. Receive inbound message from WhatsApp
2. Get or create session from Redis
3. Call TypeBot API (startChat or continueChat)
4. Map TypeBot response to WhatsApp messages
5. Apply delays (fixed, per-message, random)
6. Store options for future button/list responses
7. Log all activities
8. Return outbound messages

**Key Features**:
- Session lifecycle management
- Option ID resolution for buttons/lists
- Error handling and recovery
- Comprehensive logging
- PII masking

#### 2.5 Input Validator (`input-validator.ts`)

Validates user input based on TypeBot's expected input type.

**Supported Types**:
- `text` - Any text input
- `number` - Numeric values only
- `email` - Valid email format
- `phone` - Valid phone number format
- `url` - Valid URL format
- `date` - Valid date format
- `file` - File upload (handled separately)

**Features**:
- Regex-based validation
- User-friendly error messages
- Type-specific instructions

### 3. Integration Services (`src/backend/lib/`)

#### 3.1 TypeBot Service (`typebot-service.ts`)

Service layer for managing TypeBot bridges at the tenant level.

**Functions**:
- `initializeTypeBotBridge()` - Set up bridge for tenant
- `getTypeBotBridge()` - Get active bridge instance
- `handleTypeBotMessage()` - Process incoming message
- `updateTypeBotConfig()` - Update bridge configuration
- `removeTypeBotBridge()` - Clean up bridge resources

**Features**:
- Tenant isolation
- Bridge instance pooling
- Configuration management
- Automatic initialization

#### 3.2 TypeBot Sender (`typebot-sender.ts`)

Handles sending TypeBot responses back to WhatsApp.

**Functions**:
- `sendTypeBotMessages()` - Send array of messages
- `sendTextMessage()` - Send text
- `sendMediaMessage()` - Send media with reupload
- `sendButtonsMessage()` - Format and send buttons
- `sendListMessage()` - Format and send list

**Features**:
- Automatic media cleanup
- Delay management
- Typing simulation
- Error handling per message

### 4. WhatsApp Server (`src/backend/whatsapp-server.ts`)

Express server that ties everything together.

**Integration Points**:
```javascript
// On message received
onMessage: async (message) => {
  const outbound = await handleTypeBotMessage(
    tenantId, 
    message.from, 
    message.body
  )
  
  if (outbound) {
    await sendTypeBotMessages(
      engine, 
      outbound.to, 
      outbound.messages, 
      outbound.delay
    )
  }
}
```

**API Endpoints**:
- `GET /api/typebot/flows/:tenantId`
- `POST /api/typebot/flows/:tenantId`
- `PUT /api/typebot/flows/:tenantId/:flowId`
- `DELETE /api/typebot/flows/:tenantId/:flowId`
- `GET /api/typebot/logs/:tenantId`
- `POST /api/typebot/test/:tenantId`

### 5. Frontend Admin UI (`app/dashboard/typebot/`)

React/Next.js dashboard for managing TypeBot flows.

**Features**:
- Flow CRUD operations
- Configuration editor
- Real-time logs viewer
- Test interface
- Status monitoring

**Components**:
- Flow list with cards
- Create/edit dialogs
- Configuration form
- Logs table with filtering
- Test panel

## Data Flow

### Inbound Message Flow

```
1. User sends WhatsApp message
   ↓
2. WhatsApp Web.js receives message
   ↓
3. onMessage handler triggered
   ↓
4. handleTypeBotMessage() called
   ↓
5. Get/create session from Redis
   ↓
6. Call TypeBot API (startChat or continueChat)
   ↓
7. TypeBot processes and responds
   ↓
8. Map TypeBot messages to WhatsApp format
   ↓
9. Store options in Redis (if any)
   ↓
10. Log inbound and outbound messages
    ↓
11. sendTypeBotMessages() sends to WhatsApp
    ↓
12. User receives response
```

### Session Management Flow

```
┌─────────────────────────────────────┐
│ Inbound Message                     │
└───────────────┬─────────────────────┘
                │
                ▼
        ┌───────────────┐
        │ Check Redis   │
        │ for session   │
        └───────┬───────┘
                │
        ┌───────┴────────┐
        │                │
     EXISTS          NOT EXISTS
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│ Get session  │  │ Create new   │
│ Update TTL   │  │ session      │
│ Update time  │  │ Call start   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
                ▼
        ┌───────────────┐
        │ Call continue │
        │ or start chat │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Save options  │
        │ Update state  │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Return msgs   │
        └───────────────┘
```

### Message Processing Pipeline

```
Raw TypeBot Message
        │
        ▼
┌──────────────────┐
│ Extract text     │
│ Extract media    │
│ Extract options  │
│ Extract input    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Determine type   │
│ text / media /   │
│ buttons / list   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Map to WhatsApp  │
│ format           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Apply rewrite    │
│ rules (if any)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Download media   │
│ (if reupload)    │
└────────┬─────────┘
         │
         ▼
WhatsApp Message
```

## Database Schema

### typebot_flows

Stores TypeBot flow configurations.

```sql
CREATE TABLE typebot_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    flow_url TEXT NOT NULL,
    token TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Settings Structure**:
```json
{
  "preferReupload": true,
  "enableUrlRewrite": false,
  "urlRewriteMap": {
    "pattern": "replacement"
  },
  "delays": {
    "fixed": 1000,
    "perMessage": 500,
    "random": { "min": 200, "max": 800 }
  }
}
```

### typebot_logs

Logs all TypeBot interactions.

```sql
CREATE TABLE typebot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    session_id VARCHAR(255),
    direction VARCHAR(20) NOT NULL,
    content TEXT,
    message_type VARCHAR(50),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Direction Values**:
- `inbound` - Message from user to TypeBot
- `outbound` - Message from TypeBot to user
- `error` - Error occurred during processing

### typebot_sessions

Optional database backup of Redis sessions.

```sql
CREATE TABLE typebot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    flow_url TEXT,
    last_activity TIMESTAMP WITH TIME ZONE,
    state JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(phone, session_id)
);
```

## Configuration Management

### Environment Variables

```
TYPEBOT_ENABLED          - Enable/disable bridge
TYPEBOT_FLOW_URL         - Default flow URL
TYPEBOT_TOKEN            - Default auth token
TYPEBOT_PREFER_REUPLOAD  - Default media setting
REDIS_HOST               - Redis server host
REDIS_PORT               - Redis server port
REDIS_PASSWORD           - Redis authentication
REDIS_DB                 - Redis database number
```

### Per-Flow Configuration

Each flow can override defaults:
- Custom TypeBot URL
- Custom authentication token
- Media reupload preference
- URL rewrite rules
- Delay settings

### Runtime Configuration

Configuration can be updated via:
1. Admin UI (Dashboard → TypeBot → Config)
2. API calls (`PUT /api/typebot/flows/:tenantId/:flowId`)
3. Database updates (typebot_flows.settings)

Changes take effect immediately for new messages.

## Security

### Token Management

- Tokens stored in database (encrypted at rest)
- Never exposed in client-side code
- Sent via Authorization header
- Rotatable without code changes

### PII Protection

- Phone numbers masked in logs: `+55119***90707`
- Full numbers stored in Redis (ephemeral)
- Full numbers in database for operational needs
- Configurable retention periods

### Rate Limiting

- Per-tenant limits
- Per-user limits
- Global rate limiting
- Exponential backoff on errors

### Input Validation

- Sanitize all user inputs
- Validate against expected types
- Prevent injection attacks
- Limit message sizes

## Performance Considerations

### Redis Optimization

- Use connection pooling
- Enable pipelining for bulk operations
- Set appropriate TTLs
- Monitor memory usage
- Use Redis Cluster for scale

### API Optimization

- Implement request caching
- Use HTTP keep-alive
- Batch requests when possible
- Implement circuit breakers
- Monitor latency metrics

### Media Handling

- Stream downloads/uploads
- Clean up temp files promptly
- Limit concurrent media operations
- Use CDN for media when possible
- Compress images before upload

## Monitoring

### Key Metrics

- **Messages processed/second**
- **Average response time**
- **Error rate**
- **Session count**
- **Redis memory usage**
- **API call latency**

### Health Checks

```javascript
// Backend health
GET /health

// Redis health
redis-cli PING

// TypeBot API health
curl {TYPEBOT_URL}/health
```

### Logging

- Structured JSON logs
- Correlation IDs for request tracking
- Log levels: DEBUG, INFO, WARN, ERROR
- Separate logs for audit trail
- PII masking in all logs

## Scaling

### Horizontal Scaling

- Run multiple backend instances
- Use Redis for session sharing
- Load balance with Nginx/HAProxy
- Sticky sessions not required

### Vertical Scaling

- Increase Redis memory
- Add more CPU cores
- Optimize database queries
- Increase connection pools

### Redis Scaling

- Redis Cluster for sharding
- Redis Sentinel for HA
- Read replicas for read-heavy loads
- Separate Redis for sessions vs cache

## Error Handling

### Error Categories

1. **Network Errors**: Retry with backoff
2. **API Errors**: Log and return friendly message
3. **Validation Errors**: Prompt user for correction
4. **Session Errors**: Create new session
5. **System Errors**: Alert and investigate

### Recovery Strategies

- Automatic retry with exponential backoff
- Circuit breaker for downstream services
- Graceful degradation when possible
- Clear error messages to users
- Detailed logging for debugging

## Testing

### Unit Tests

Test individual components:
- Redis client operations
- Message mapping logic
- Input validation
- API client methods

### Integration Tests

Test component interactions:
- Bridge end-to-end flow
- WhatsApp → TypeBot → WhatsApp
- Session management
- Error scenarios

### Load Tests

- Simulate high message volume
- Test Redis performance under load
- Measure response times
- Identify bottlenecks

## Future Enhancements

- [ ] Support for TypeBot webhooks
- [ ] Advanced analytics and reporting
- [ ] A/B testing for flows
- [ ] Multi-language support
- [ ] Voice message support
- [ ] Group chat support
- [ ] Scheduled messages
- [ ] Custom actions/integrations
- [ ] Machine learning insights
- [ ] Sentiment analysis

## References

- [TypeBot API Documentation](https://docs.typebot.io/)
- [whatsapp-web.js Documentation](https://wwebjs.dev/)
- [Redis Documentation](https://redis.io/docs/)
- [Express.js Documentation](https://expressjs.com/)
