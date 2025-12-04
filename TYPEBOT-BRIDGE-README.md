# TypeBot Bridge - Deployment Guide

## Overview

This guide explains how to build and deploy the TypeBot Bridge microservice to Docker Hub for use with your VPS.

## What Was Created

1. **`Dockerfile.typebot-bridge`** - Docker configuration for building the typebot-bridge image
2. **`src/backend/typebot-bridge-server.ts`** - Main API server for handling WhatsApp ↔ TypeBot communication
3. **`src/backend/typebot-bridge-worker.ts`** - Background worker for session cleanup and queue processing
4. **`ecosystem.typebot-bridge.config.js`** - PM2 configuration for running both processes
5. **`.dockerignore.typebot`** - Custom dockerignore that allows the `dist` folder to be copied
6. **`TYPEBOT-BRIDGE-DOCKER.md`** - Detailed documentation for building and deploying

## Quick Start - Building and Pushing to Docker Hub

### Step 1: Build the TypeScript Code Locally

```bash
# Navigate to your project directory
cd /path/to/promolinxy-saas-bot-whatsapp

# Install dependencies (skip puppeteer to avoid issues)
PUPPETEER_SKIP_DOWNLOAD=true npm install

# Build the backend code
npm run build:backend
```

This creates the `dist` directory with compiled JavaScript files.

### Step 2: Build the Docker Image

```bash
# Temporarily use the typebot dockerignore (allows dist folder)
cp .dockerignore.typebot .dockerignore

# Build the Docker image
docker build -f Dockerfile.typebot-bridge -t kauameloo/typebot-bridge:latest .

# Restore original dockerignore
git checkout .dockerignore
```

### Step 3: Push to Docker Hub

```bash
# Login to Docker Hub
docker login

# Push the image
docker push kauameloo/typebot-bridge:latest

# Optional: Tag with version
docker tag kauameloo/typebot-bridge:latest kauameloo/typebot-bridge:v1.0.0
docker push kauameloo/typebot-bridge:v1.0.0
```

## One-Line Build Command

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install && npm run build:backend && cp .dockerignore.typebot .dockerignore && docker build -f Dockerfile.typebot-bridge -t kauameloo/typebot-bridge:latest . && docker push kauameloo/typebot-bridge:latest && git checkout .dockerignore
```

## Using in Docker Compose

The image is now ready to use in your docker-compose.yml:

```yaml
typebot-bridge:
  image: kauameloo/typebot-bridge:latest
  restart: unless-stopped
  environment:
    NODE_ENV: production
    TYPEBOT_FLOW_URL: "https://bot.promolinxy.online/chatbot"
    TYPEBOT_TOKEN: "dFFZwBGJE2gQuXLcnVyXYpfj"
    TYPEBOT_ENABLED: "true"
    REDIS_URL: "redis://redis:6379/0"
    DATABASE_URL: "postgresql://typebot:typebotpass@postgres-typebot:5432/typebot"
    WHATSAPP_SEND_URL: "http://whatsapp-engine:3001/api/whatsapp/send"
  ports:
    - "3010:3010"
  depends_on:
    - redis
    - whatsapp-engine
    - postgres-typebot
  networks:
    - stack-network
```

## Deploying on Your VPS

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Pull the latest image
docker pull kauameloo/typebot-bridge:latest

# Start the service
docker-compose up -d typebot-bridge
```

## API Endpoints

The typebot-bridge service exposes the following endpoints:

- **`GET /health`** - Health check endpoint
- **`POST /api/typebot/message`** - Process incoming WhatsApp message
- **`POST /api/typebot/start`** - Start a new conversation
- **`GET /api/typebot/session/:phone`** - Get session info
- **`GET /api/typebot/stats`** - Get bridge statistics

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TYPEBOT_FLOW_URL` | Yes | - | URL to your TypeBot flow |
| `TYPEBOT_TOKEN` | No | - | Authentication token for TypeBot |
| `TYPEBOT_ENABLED` | No | `false` | Enable/disable the bridge |
| `REDIS_URL` | Yes | - | Redis connection URL |
| `DATABASE_URL` | Yes | - | PostgreSQL connection URL |
| `WHATSAPP_SEND_URL` | Yes | - | WhatsApp engine API endpoint |
| `TYPEBOT_BRIDGE_PORT` | No | `3010` | Port for API server |
| `TYPEBOT_SESSION_TTL_HOURS` | No | `72` | Session TTL in hours |
| `TYPEBOT_DEFAULT_DELAY_MS` | No | `500` | Delay between messages |
| `TYPEBOT_PREFER_REUPLOAD` | No | `true` | Prefer reuploading media |

## Architecture

The TypeBot Bridge consists of two processes running via PM2:

1. **Server Process** (`typebot-bridge-server.js`)
   - REST API for handling WhatsApp messages
   - Sends messages to TypeBot and receives responses
   - Returns formatted messages to WhatsApp engine

2. **Worker Process** (`typebot-bridge-worker.js`)
   - Background worker for session cleanup
   - Removes expired sessions based on TTL
   - Can be extended for queue processing

Both processes run in a single Docker container for simplicity.

## Troubleshooting

### Build fails with npm errors

This is due to npm dependency issues in Docker. Solution:
- Always build TypeScript code locally first
- Use the `.dockerignore.typebot` file during Docker build
- Follow the step-by-step build process above

### Container fails to start

Check logs:
```bash
docker logs typebot-bridge
```

Common issues:
- Missing environment variables (especially REDIS_URL, DATABASE_URL)
- Redis or PostgreSQL not accessible
- Port 3010 already in use

### Health check failing

Test the endpoint:
```bash
curl http://localhost:3010/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "typebot-bridge",
  "timestamp": "2025-12-04T08:00:00.000Z"
}
```

## Next Steps

1. Build and push the image to Docker Hub (see steps above)
2. Update your docker-compose.yml on your VPS
3. Pull and start the container
4. Test the integration by sending a WhatsApp message
5. Monitor logs to ensure everything works correctly

## Support

For more detailed information, see:
- `TYPEBOT-BRIDGE-DOCKER.md` - Comprehensive Docker documentation
- `src/backend/typebot-bridge-server.ts` - Server implementation
- `src/backend/typebot-bridge-worker.ts` - Worker implementation

## Summary

You now have:
✅ A complete Dockerfile for TypeBot Bridge  
✅ Standalone server and worker processes  
✅ PM2 configuration for process management  
✅ Health checks and logging  
✅ Ready to deploy to Docker Hub and your VPS  

The image can be built locally and pushed to `kauameloo/typebot-bridge:latest` for use in your production environment.
