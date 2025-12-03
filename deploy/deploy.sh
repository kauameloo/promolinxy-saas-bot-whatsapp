#!/bin/bash

# =====================================================
# Deploy Script - Start all services
# =====================================================

set -e

echo "=================================================="
echo "🚀 PromoLinxy SaaS Bot - Deployment"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml not found!${NC}"
    echo "Please make sure you're in the project directory."
    exit 1
fi

# Check if Caddyfile exists
if [ ! -f "Caddyfile" ]; then
    echo -e "${RED}❌ Caddyfile not found!${NC}"
    echo "Please create the Caddyfile before deploying."
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ Warning: .env file not found${NC}"
    echo "Creating .env from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env file${NC}"
        echo -e "${YELLOW}⚠ Please edit .env with your configuration before continuing${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found either!${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ All required files found${NC}"
echo ""

# Step 1: Stop existing containers
echo "=================================================="
echo "🛑 Step 1: Stopping existing containers..."
echo "=================================================="
docker compose down || true
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Step 2: Pull latest images
echo "=================================================="
echo "📥 Step 2: Pulling latest images..."
echo "=================================================="
docker compose pull
echo -e "${GREEN}✓ Images pulled${NC}"
echo ""

# Step 3: Build custom images
echo "=================================================="
echo "🔨 Step 3: Building custom images..."
echo "=================================================="
docker compose build --no-cache
echo -e "${GREEN}✓ Images built${NC}"
echo ""

# Step 4: Start services
echo "=================================================="
echo "🚀 Step 4: Starting services..."
echo "=================================================="
docker compose up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Step 5: Wait for services to be ready
echo "=================================================="
echo "⏳ Step 5: Waiting for services to be ready..."
echo "=================================================="
echo "This may take a few minutes..."
sleep 30

# Check service status
echo ""
echo "Checking service status..."
docker compose ps
echo ""

# Step 6: Check logs for errors
echo "=================================================="
echo "📋 Step 6: Checking logs..."
echo "=================================================="
echo "Checking for critical errors in the last 50 lines..."
docker compose logs --tail=50 | grep -i error || echo "No errors found in recent logs"
echo ""

# Summary
echo "=================================================="
echo "✅ Deployment Complete!"
echo "=================================================="
echo ""
echo "Your services should now be accessible at:"
echo "  🌐 Frontend:        https://app.promolinxy.online"
echo "  🔧 Backend API:     https://backend.promolinxy.online"
echo "  🤖 Typebot Builder: https://builder.promolinxy.online"
echo "  💬 Typebot Viewer:  https://bot.promolinxy.online"
echo "  ⚙️  N8N:             https://n8n.promolinxy.online"
echo ""
echo "Useful commands:"
echo "  • View logs:        docker compose logs -f [service-name]"
echo "  • Restart service:  docker compose restart [service-name]"
echo "  • Stop all:         docker compose down"
echo "  • View status:      docker compose ps"
echo ""
echo "To check if SSL certificates are working:"
echo "  curl -I https://app.promolinxy.online"
echo ""
