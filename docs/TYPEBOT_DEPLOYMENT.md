# TypeBot Bridge - Deployment Guide

## Overview

This guide explains how to deploy and configure the TypeBot Bridge integration for bidirectional WhatsApp ↔ TypeBot communication.

## Prerequisites

### Required Services
1. **PostgreSQL Database** (Neon or self-hosted)
2. **Redis Server** (for session management)
3. **WhatsApp Web.js Backend** (already included)
4. **TypeBot Instance** (public URL accessible)

### Required Information
- TypeBot public flow URL (e.g., `https://bot.promolinxy.online/chatbot`)
- TypeBot authentication token (if required)
- Redis connection details
- PostgreSQL connection details

## Step 1: Install Dependencies

The required packages are already added to `package.json`:

```bash
npm install
```

Key dependencies:
- `ioredis` - Redis client for session management
- `axios` - HTTP client for TypeBot API
- `redis` - Alternative Redis client

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# =====================================================
# TypeBot Bridge Integration
# =====================================================

# TypeBot Flow URL (public chatbot URL)
TYPEBOT_FLOW_URL=https://bot.promolinxy.online/chatbot

# TypeBot Authentication Token (Bearer token)
TYPEBOT_TOKEN=dFFZwBGJE2gQuXLcnVyXYpfj

# Enable/Disable TypeBot Bridge
TYPEBOT_ENABLED=true

# TypeBot Bridge Settings
TYPEBOT_PREFER_REUPLOAD=true
TYPEBOT_ENABLE_URL_REWRITE=false

# =====================================================
# Redis Configuration (for TypeBot sessions)
# =====================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Redis URL (alternative to individual settings)
# REDIS_URL=redis://localhost:6379/0
```

### Environment Variables Explained

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TYPEBOT_FLOW_URL` | Public URL of your TypeBot flow | - | Yes |
| `TYPEBOT_TOKEN` | Authentication token for TypeBot API | - | If flow requires auth |
| `TYPEBOT_ENABLED` | Enable/disable TypeBot bridge | `false` | No |
| `TYPEBOT_PREFER_REUPLOAD` | Download and reupload media files | `true` | No |
| `TYPEBOT_ENABLE_URL_REWRITE` | Enable URL rewriting in messages | `false` | No |
| `REDIS_HOST` | Redis server hostname | `localhost` | Yes |
| `REDIS_PORT` | Redis server port | `6379` | Yes |
| `REDIS_PASSWORD` | Redis password | - | If Redis requires auth |
| `REDIS_DB` | Redis database number | `0` | No |

## Step 3: Set Up Database

Run the TypeBot bridge schema migration:

```bash
# If you have psql installed
psql $DATABASE_URL -f scripts/003-typebot-bridge-schema.sql

# Or use your database tool to execute the SQL file
```

This creates the following tables:
- `typebot_flows` - TypeBot flow configurations
- `typebot_logs` - Message and event logs
- `typebot_sessions` - Optional session backup

## Step 4: Start Redis Server

### Using Docker

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:alpine
```

### Using Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

### Verify Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

## Step 5: Build and Start Backend

```bash
# Build backend
npm run build:backend

# Start backend server
npm run start:backend

# Or use PM2 for production
pm2 start ecosystem.config.js
```

The backend will:
1. Connect to Redis
2. Initialize TypeBot bridge service
3. Listen for WhatsApp messages
4. Forward messages to TypeBot
5. Send TypeBot responses back to WhatsApp

## Step 6: Configure TypeBot Flow

### In the Dashboard

1. Navigate to **Dashboard → TypeBot**
2. Click **New Flow**
3. Fill in the form:
   - **Flow Name**: Descriptive name for your flow
   - **TypeBot Public URL**: Your TypeBot chatbot URL
   - **Authentication Token**: (Optional) If your TypeBot requires authentication
4. Click **Create Flow**

### Configure Settings

Click the **Config** button on your flow to adjust:

#### Media Settings
- **Prefer Media Reupload**: Download media from TypeBot and reupload to WhatsApp
  - ✅ Enabled: Better reliability, uses more bandwidth
  - ❌ Disabled: Send media URLs directly, faster but may fail

#### URL Rewrite (Advanced)
- Enable URL rewriting to transform URLs in messages
- Configure mapping rules in settings

#### Delays
Configure delays to make the bot feel more natural:

- **Fixed Delay**: Base delay for all responses (milliseconds)
- **Per-Message Delay**: Additional delay per message sent (milliseconds)
- **Random Min/Max**: Add random delay range (milliseconds)

Example configuration for natural behavior:
```json
{
  "fixed": 1000,
  "perMessage": 500,
  "random": { "min": 200, "max": 800 }
}
```

This means:
- Wait 1 second before first message
- Add 500ms for each additional message
- Add random 200-800ms per message

## Step 7: Test the Integration

### Using the Test Interface

1. In Dashboard → TypeBot, click **Test Flow**
2. Enter a phone number (e.g., `+5511913390707`)
3. Enter a test message (e.g., `Hello`)
4. Click **Test**
5. View the response in the logs

### Using Real WhatsApp

1. Ensure WhatsApp is connected (Dashboard → WhatsApp)
2. Send a message from your phone to the WhatsApp number
3. The message will be forwarded to TypeBot
4. TypeBot's response will be sent back to your phone

### Check Logs

1. Navigate to **Dashboard → TypeBot → Logs** tab
2. View inbound and outbound messages
3. Check for any errors
4. Phone numbers are masked for privacy (`+55119***90707`)

## Step 8: Production Deployment

### 1. Use Redis with Persistence

```bash
# Update Redis command to enable persistence
redis-server --appendonly yes --save 60 1
```

### 2. Set Up SSL/TLS for Redis

```bash
# Generate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout redis.key -out redis.crt

# Start Redis with TLS
redis-server --tls-port 6380 --port 0 \
  --tls-cert-file ./redis.crt \
  --tls-key-file ./redis.key \
  --tls-ca-cert-file ./ca.crt
```

Update `.env`:
```bash
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_TLS=true
```

### 3. Configure Firewall

Allow Redis connections only from trusted IPs:

```bash
# UFW example
sudo ufw allow from 10.0.0.0/8 to any port 6379
```

### 4. Set Up Monitoring

Monitor Redis health:
```bash
# Check connected clients
redis-cli CLIENT LIST

# Check memory usage
redis-cli INFO memory

# Check key count
redis-cli DBSIZE
```

### 5. Configure Backups

Backup Redis data:
```bash
# Manual backup
redis-cli BGSAVE

# Automated backup (add to cron)
0 */6 * * * redis-cli BGSAVE && cp /var/lib/redis/dump.rdb /backup/redis-$(date +\%Y\%m\%d-\%H\%M).rdb
```

### 6. Scale Redis (Optional)

For high-traffic deployments, consider:

- **Redis Cluster**: Horizontal scaling with sharding
- **Redis Sentinel**: High availability with automatic failover
- **Managed Redis**: AWS ElastiCache, Google Cloud Memorystore, or Redis Cloud

### 7. Environment-Specific Configuration

#### Development
```bash
TYPEBOT_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Staging
```bash
TYPEBOT_ENABLED=true
REDIS_HOST=staging-redis.internal
REDIS_PORT=6379
REDIS_PASSWORD=staging_password
```

#### Production
```bash
TYPEBOT_ENABLED=true
REDIS_HOST=prod-redis.internal
REDIS_PORT=6380
REDIS_PASSWORD=strong_production_password
REDIS_TLS=true
```

## Troubleshooting

### Redis Connection Failed

**Error**: `Error: Redis connection failed: ECONNREFUSED`

**Solutions**:
1. Check if Redis is running: `redis-cli ping`
2. Verify Redis host and port in `.env`
3. Check firewall rules
4. Verify Redis password (if required)

### TypeBot API Errors

**Error**: `TypeBot API returned 401 Unauthorized`

**Solutions**:
1. Verify `TYPEBOT_TOKEN` is correct
2. Check if token has expired
3. Confirm TypeBot URL is accessible
4. Test TypeBot URL in browser

### Session Not Found

**Error**: `Session not found for phone: +5511...`

**Solutions**:
1. Redis may have restarted (sessions lost)
2. Session TTL expired (72 hours default)
3. Check Redis connection
4. User can send `/start` to create new session

### Media Upload Failed

**Error**: `Failed to upload media`

**Solutions**:
1. Check network connectivity to media URL
2. Verify media URL is publicly accessible
3. Try disabling `TYPEBOT_PREFER_REUPLOAD`
4. Check media file size limits

### Rate Limiting

If you encounter rate limiting:

1. Adjust delays in flow configuration
2. Implement exponential backoff
3. Reduce message frequency
4. Contact TypeBot support for rate limit increase

## Performance Optimization

### Redis Optimization

```bash
# Increase maxmemory
redis-cli CONFIG SET maxmemory 2gb

# Set eviction policy for session data
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Disable AOF for better performance (less durability)
redis-cli CONFIG SET appendonly no

# Enable RDB snapshots instead
redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

### Backend Optimization

```javascript
// Adjust Redis connection pool
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
}
```

## Monitoring

### Redis Metrics

Monitor these key metrics:

```bash
# Memory usage
redis-cli INFO memory | grep used_memory_human

# Key count
redis-cli DBSIZE

# Connected clients
redis-cli INFO clients | grep connected_clients

# Operations per second
redis-cli INFO stats | grep instantaneous_ops_per_sec

# Hit rate
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses
```

### Application Metrics

Log important events:
- Session created
- Session expired
- Message processed
- API errors
- Rate limit hits

Example logging:
```javascript
console.log({
  event: "typebot_message_processed",
  sessionId: session.sessionId,
  phone: maskPhone(phone),
  messageCount: messages.length,
  latency: Date.now() - startTime,
})
```

## Security Best Practices

1. **Never commit sensitive credentials**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Use strong Redis passwords**
   ```bash
   # Generate strong password
   openssl rand -base64 32
   ```

3. **Enable Redis ACL** (Redis 6+)
   ```bash
   # Create user with limited permissions
   redis-cli ACL SETUSER typebot on >password ~typebot:* +@all
   ```

4. **Implement rate limiting**
   - Limit requests per user
   - Prevent abuse

5. **Mask PII in logs**
   - Already implemented for phone numbers
   - Never log full tokens or passwords

6. **Use HTTPS for TypeBot**
   - Always use `https://` URLs
   - Verify SSL certificates

## Support

If you encounter issues:

1. Check the logs: Dashboard → TypeBot → Logs
2. Verify all environment variables are set
3. Test Redis connection: `redis-cli ping`
4. Test TypeBot API manually with curl
5. Review this documentation
6. Contact support with:
   - Error messages
   - Configuration (without sensitive data)
   - Steps to reproduce

## Next Steps

- Review [API Documentation](./TYPEBOT_API.md)
- Set up [Monitoring and Alerts](./MONITORING.md)
- Read [Architecture Overview](./ARCHITECTURE.md)
- Configure [Advanced Features](./ADVANCED.md)
