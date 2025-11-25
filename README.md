# SaaS WhatsApp automation

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/kauameloos-projects/v0-saa-s-bot-whatsapp)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/eR4TaBXExDy)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/kauameloos-projects/v0-saa-s-bot-whatsapp](https://vercel.com/kauameloos-projects/v0-saa-s-bot-whatsapp)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/eR4TaBXExDy](https://v0.app/chat/eR4TaBXExDy)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Local development (Docker)

Quick start using Docker Compose (recommended to reproduce production-like environment):

1. Copy the example env file and review values:

```bash
cp .env.example .env
# Edit .env as needed (especially JWT_SECRET and CAKTO_WEBHOOK_SECRET)
```

2. Start services with Docker Compose:

```bash
docker compose up --build
```

This will bring up the frontend (Next.js), the WhatsApp engine service, PostgreSQL and Redis as defined in `docker-compose.yml`.

3. Open the dashboard at: http://localhost:3000

Notes:
- The WhatsApp engine stores sessions in a Docker volume (`whatsapp-sessions`) so that QR codes and session files persist between restarts.
- For local development you may run the frontend in dev mode (`pnpm dev` or `npm run dev`) after installing dependencies.

If you need to run only the frontend (no Docker):

```bash
pnpm install
pnpm dev
```
