# TypeBot Bridge Integration

Complete bidirectional integration between WhatsApp and TypeBot for automated conversational flows.

## 🎯 Features

### Core Functionality
- ✅ **Bidirectional Bridge**: WhatsApp ↔ TypeBot communication
- ✅ **Session Management**: Redis-backed sessions with 72h TTL
- ✅ **Full Message Support**: Text, media, buttons, lists, and more
- ✅ **Input Validation**: Type-safe user input validation
- ✅ **Media Handling**: Automatic download and reupload
- ✅ **Smart Delays**: Fixed, per-message, and random delays
- ✅ **URL Rewriting**: Configurable URL transformation
- ✅ **PII Protection**: Automatic phone number masking in logs

### Admin Features
- 📊 **Flow Management**: Create, configure, and manage TypeBot flows
- 📈 **Real-time Logs**: View message history with filtering
- 🧪 **Test Interface**: Test flows without sending to WhatsApp
- ⚙️ **Configuration Panel**: Fine-tune delays and settings
- 🔄 **Status Monitoring**: Real-time bridge health status

## 🚀 Quick Start

### Prerequisites

```bash
# Required services
- PostgreSQL database
- Redis server
- WhatsApp Web.js backend
- TypeBot instance (public URL)
```

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Set up database**
   ```bash
   psql $DATABASE_URL -f scripts/003-typebot-bridge-schema.sql
   ```

4. **Start Redis**
   ```bash
   docker run -d --name redis -p 6379:6379 redis:alpine
   ```

5. **Build and start backend**
   ```bash
   npm run build:backend
   npm run start:backend
   ```

6. **Access dashboard**
   ```
   Navigate to: http://localhost:3000/dashboard/typebot
   ```

## 📚 Documentation

- **[Deployment Guide](./docs/TYPEBOT_DEPLOYMENT.md)** - Complete deployment instructions
- **[API Documentation](./docs/TYPEBOT_API.md)** - REST API reference
- **[Architecture](./docs/TYPEBOT_ARCHITECTURE.md)** - System architecture overview
- **[Production Checklist](./docs/TYPEBOT_PRODUCTION_CHECKLIST.md)** - Pre-launch checklist

## 🏗️ Architecture

```
WhatsApp User → WhatsApp Web.js → TypeBot Bridge → TypeBot API
                                        ↓
                                   Redis + DB
```

### Components

1. **TypeBot Client** - HTTP client for TypeBot API
2. **Message Mapper** - TypeBot ↔ WhatsApp format conversion
3. **Bridge Controller** - Orchestrates bidirectional communication
4. **Redis Client** - Session and state management
5. **Input Validator** - Type-safe input validation
6. **Admin UI** - React/Next.js dashboard

## ⚙️ Configuration

### Environment Variables

```bash
# TypeBot Settings
TYPEBOT_FLOW_URL=https://bot.promolinxy.online/chatbot
TYPEBOT_TOKEN=your_token_here
TYPEBOT_ENABLED=true
TYPEBOT_PREFER_REUPLOAD=true

# Redis Settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Flow Configuration

Configure per-flow settings in the admin UI:

- **Media Reupload**: Download and reupload media for reliability
- **URL Rewrite**: Transform URLs in messages
- **Delays**:
  - Fixed: Base delay for all responses
  - Per-Message: Additional delay per message
  - Random: Add randomness for natural feel

Example:
```json
{
  "preferReupload": true,
  "enableUrlRewrite": false,
  "delays": {
    "fixed": 1000,
    "perMessage": 500,
    "random": { "min": 200, "max": 800 }
  }
}
```

## 🧪 Testing

### Test Interface

1. Go to **Dashboard → TypeBot → Test Flow**
2. Enter phone number: `+5511913390707`
3. Enter test message: `Hello`
4. Click **Test**
5. View response in logs

### Manual Testing

Send a WhatsApp message to your connected number and verify:
- ✅ Message reaches TypeBot
- ✅ Response returns to WhatsApp
- ✅ Logs show both inbound and outbound
- ✅ Sessions persist across messages

## 📊 Message Types

### Text Messages
```
User: "Hello"
Bot: "Hi! How can I help you?"
```

### Buttons (≤3 options)
```
Bot: "What would you like to do?"
1. Get Started
2. Learn More
3. Contact Us
```

### Lists (>3 options)
```
Bot: "Choose a category:"
1. Products
2. Services
3. Support
4. About Us
5. Contact
```

### Media
- Images (JPEG, PNG, GIF, WebP)
- Videos (MP4, WebM)
- Audio (MP3, OGG, WAV)
- Documents (PDF, DOC, etc.)

## 🔒 Security

- **Token Storage**: Encrypted at rest
- **PII Masking**: Phone numbers masked in logs (`+55119***90707`)
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Sanitize all inputs
- **Session Isolation**: Tenant-level isolation

## 📈 Monitoring

### Key Metrics

- Messages processed per second
- Average response time
- Error rate
- Active sessions
- Redis memory usage

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health

# Redis health
redis-cli ping

# View active sessions
redis-cli KEYS "typebot:session:*" | wc -l
```

## 🐛 Troubleshooting

### Common Issues

**Redis Connection Failed**
```bash
# Check Redis is running
redis-cli ping

# Verify connection details in .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

**TypeBot API Error 401**
```bash
# Verify token is correct
TYPEBOT_TOKEN=dFFZwBGJE2gQuXLcnVyXYpfj

# Test manually
curl -H "Authorization: Bearer $TYPEBOT_TOKEN" \
  https://bot.promolinxy.online/chatbot/api/v1/typebots/start
```

**Session Not Found**
- Session may have expired (72h TTL)
- Redis may have restarted
- User can send `/start` to create new session

## 🔄 Message Flow

```
1. User sends WhatsApp message
2. WhatsApp Web.js receives and triggers handler
3. Bridge gets/creates session from Redis
4. Bridge calls TypeBot API (startChat or continueChat)
5. TypeBot processes and returns response
6. Bridge maps TypeBot response to WhatsApp format
7. Bridge stores button/list options (if any)
8. Bridge logs inbound and outbound messages
9. Bridge sends messages to WhatsApp
10. User receives response
```

## 📋 API Endpoints

- `GET /api/typebot/flows/:tenantId` - List flows
- `POST /api/typebot/flows/:tenantId` - Create flow
- `PUT /api/typebot/flows/:tenantId/:flowId` - Update flow
- `DELETE /api/typebot/flows/:tenantId/:flowId` - Delete flow
- `GET /api/typebot/logs/:tenantId` - Get logs
- `POST /api/typebot/test/:tenantId` - Test flow

See [API Documentation](./docs/TYPEBOT_API.md) for details.

## 🗄️ Database Schema

### typebot_flows
Stores TypeBot flow configurations.

### typebot_logs
Logs all message interactions (inbound/outbound).

### typebot_sessions
Optional backup of Redis sessions.

## 🎨 Frontend Components

### Dashboard
- **Flows Tab**: Manage TypeBot flows
- **Logs Tab**: View message history
- **Config Dialog**: Configure flow settings
- **Test Dialog**: Test flows manually

## 🚀 Deployment

### Development
```bash
npm run dev              # Frontend
npm run dev:backend      # Backend (watch mode)
```

### Production
```bash
npm run build
npm run build:backend
npm run start            # Frontend
npm run start:backend    # Backend
```

### Docker
```bash
docker-compose up -d
```

See [Deployment Guide](./docs/TYPEBOT_DEPLOYMENT.md) for full instructions.

## 🛠️ Development

### Project Structure
```
src/backend/
├── integrations/
│   └── typebot-bridge/
│       ├── bridge.ts           # Main orchestrator
│       ├── typebot-client.ts   # TypeBot API client
│       ├── message-mapper.ts   # Message format converter
│       ├── redis-client.ts     # Redis session manager
│       ├── input-validator.ts  # Input validation
│       └── index.ts            # Exports
├── lib/
│   ├── typebot-service.ts      # Service layer
│   └── typebot-sender.ts       # WhatsApp sender
└── whatsapp-server.ts          # Express server

app/dashboard/
└── typebot/
    └── page.tsx                # Admin UI

docs/
├── TYPEBOT_DEPLOYMENT.md       # Deployment guide
├── TYPEBOT_API.md              # API reference
├── TYPEBOT_ARCHITECTURE.md     # Architecture docs
└── TYPEBOT_PRODUCTION_CHECKLIST.md  # Launch checklist
```

### Adding Features

1. Update TypeBot client if API changes
2. Update message mapper for new message types
3. Update bridge controller for new logic
4. Update admin UI for new settings
5. Add tests for new functionality
6. Update documentation

## 📊 Performance

### Optimization Tips

- Enable Redis persistence for reliability
- Use connection pooling for database
- Set appropriate TTLs for sessions
- Monitor Redis memory usage
- Optimize media handling
- Use CDN for media when possible

### Scaling

- **Horizontal**: Run multiple backend instances
- **Vertical**: Increase resources (CPU, memory)
- **Redis**: Use Redis Cluster for sharding
- **Database**: Add read replicas

## 🤝 Contributing

This is a private repository. For internal contributions:

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit PR with description
5. Get code review
6. Merge after approval

## 📝 License

Private - All Rights Reserved

## 🙋 Support

For issues or questions:

1. Check the documentation
2. Review troubleshooting guide
3. Check logs for errors
4. Contact support team

## 🎉 Success Metrics

- ✅ Messages processed: Track daily volume
- ✅ Response time: < 500ms (p95)
- ✅ Error rate: < 1%
- ✅ Session success: > 95%
- ✅ User satisfaction: Track feedback

## 🔮 Roadmap

- [ ] Voice message support
- [ ] Group chat support
- [ ] Advanced analytics
- [ ] A/B testing
- [ ] Multi-language support
- [ ] Custom actions
- [ ] Webhook integrations
- [ ] Machine learning insights

---

**Built with ❤️ for seamless WhatsApp ↔ TypeBot integration**

For detailed documentation, see the `/docs` directory.
