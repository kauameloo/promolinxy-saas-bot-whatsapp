# TypeBot Bridge Docker Build Instructions

## Prerequisites

Before building the Docker image, you need to build the TypeScript code locally:

```bash
# Install dependencies
PUPPETEER_SKIP_DOWNLOAD=true npm install

# Build the backend code
npm run build:backend
```

This will create the `dist` directory with the compiled JavaScript files.

## Building the Docker Image

**IMPORTANT**: Make sure you've built the code locally first (see Prerequisites above).

Then, you need to temporarily allow the `dist` directory in Docker builds. Create a `.dockerignore.typebot` file or modify your build command:

```bash
# Option 1: Build with custom dockerignore (create .dockerignore.typebot without 'dist')
docker build -f Dockerfile.typebot-bridge -t kauameloo/typebot-bridge:latest .

# Option 2: Or use the simplified Dockerfile that copies only what's needed
docker build -f Dockerfile.typebot-bridge -t kauameloo/typebot-bridge:latest --build-arg COPY_DIST=true .
```

## Pushing to Docker Hub

```bash
# Login to Docker Hub
docker login

# Tag the image (if needed)
docker tag kauameloo/typebot-bridge:latest kauameloo/typebot-bridge:latest

# Push to Docker Hub
docker push kauameloo/typebot-bridge:latest

# Optional: Push with a version tag
docker tag kauameloo/typebot-bridge:latest kauameloo/typebot-bridge:v1.0.0
docker push kauameloo/typebot-bridge:v1.0.0
```

## Quick Build Script

Due to npm dependency issues in Docker, the recommended approach is:

```bash
# Step 1: Build locally
PUPPETEER_SKIP_DOWNLOAD=true npm install
npm run build:backend

# Step 2: Use the custom dockerignore that includes dist
cp .dockerignore.typebot .dockerignore

# Step 3: Build Docker image
docker build -f Dockerfile.typebot-bridge -t kauameloo/typebot-bridge:latest .

# Step 4: Restore original dockerignore  
git checkout .dockerignore
```

Or use this one-liner:

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install && npm run build:backend && cp .dockerignore.typebot .dockerignore && docker build -f Dockerfile.typebot-bridge -t kauameloo/typebot-bridge:latest . && git checkout .dockerignore
```

## Running the Image Locally

```bash
docker run -p 3010:3010 \
  -e NODE_ENV=production \
  -e TYPEBOT_FLOW_URL=https://bot.promolinxy.online/chatbot \
  -e TYPEBOT_TOKEN=your_token_here \
  -e TYPEBOT_ENABLED=true \
  -e REDIS_URL=redis://redis:6379/0 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e WHATSAPP_SEND_URL=http://whatsapp-engine:3001/api/whatsapp/send \
  kauameloo/typebot-bridge:latest
```

## Using with Docker Compose

The typebot-bridge service is already configured in your docker-compose.yml. Simply run:

```bash
docker-compose up -d typebot-bridge typebot-bridge-worker
```

## Service Endpoints

- **Health Check**: `GET http://localhost:3010/health`
- **Process Message**: `POST http://localhost:3010/api/typebot/message`
- **Start Conversation**: `POST http://localhost:3010/api/typebot/start`
- **Get Session**: `GET http://localhost:3010/api/typebot/session/:phone`
- **Get Stats**: `GET http://localhost:3010/api/typebot/stats`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPEBOT_BRIDGE_PORT` | `3010` | Port for the API server |
| `TYPEBOT_FLOW_URL` | Required | URL to your TypeBot flow |
| `TYPEBOT_TOKEN` | Optional | Authentication token for TypeBot |
| `TYPEBOT_ENABLED` | `false` | Enable/disable the bridge |
| `TYPEBOT_PREFER_REUPLOAD` | `true` | Prefer reuploading media |
| `TYPEBOT_ENABLE_URL_REWRITE` | `false` | Enable URL rewriting |
| `REDIS_URL` | Required | Redis connection URL |
| `DATABASE_URL` | Required | PostgreSQL connection URL |
| `WHATSAPP_SEND_URL` | Required | WhatsApp engine send endpoint |
| `TYPEBOT_SESSION_TTL_HOURS` | `72` | Session TTL in hours |
| `TYPEBOT_DEFAULT_DELAY_MS` | `500` | Default delay between messages |
| `TYPEBOT_RANDOM_DELAY_MIN_MS` | `200` | Min random delay |
| `TYPEBOT_RANDOM_DELAY_MAX_MS` | `800` | Max random delay |
| `TYPEBOT_RATE_LIMIT_RPS` | `5` | Rate limit requests per second |
| `TYPEBOT_ACCEPT_OUTSIDE_24H` | `false` | Accept messages outside 24h window |
| `TYPEBOT_WORKER_INTERVAL_MS` | `5000` | Worker loop interval |

## Architecture

The TypeBot Bridge consists of two processes:

1. **Server**: REST API for receiving messages from WhatsApp and sending to TypeBot
2. **Worker**: Background process for queue processing and session cleanup

Both processes run in the same container using PM2.

## Volumes

- `/tmp/typebot-media`: Temporary storage for media files
- `/app/config`: Optional configuration overrides
- `/app/logs`: Application logs

## Health Check

The container includes a health check that pings the `/health` endpoint every 30 seconds.

## Troubleshooting

### Build fails with "npm error Exit handler never called"

This is a known issue with npm in Docker. Solutions:
1. Build the TypeScript code locally first (see Prerequisites)
2. Use `--legacy-peer-deps` flag
3. Delete `node_modules` and `package-lock.json` and rebuild

### tsc: not found error

Make sure you've installed dependencies locally before building:
```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install
npm run build:backend
```
