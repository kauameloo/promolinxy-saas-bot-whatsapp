#!/bin/bash

# =====================================================
# Health Check Script
# =====================================================

echo "=================================================="
echo "🏥 PromoLinxy SaaS Bot - Health Check"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check HTTP status
check_url() {
    local url=$1
    local name=$2
    
    echo -n "Checking $name... "
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" -k "$url" --max-time 10 || echo "000")
    
    if [ "$status_code" -eq 200 ] || [ "$status_code" -eq 302 ] || [ "$status_code" -eq 301 ]; then
        echo -e "${GREEN}✓ OK (HTTP $status_code)${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED (HTTP $status_code)${NC}"
        return 1
    fi
}

# Check Docker containers
echo "=================================================="
echo "🐳 Docker Containers Status"
echo "=================================================="
docker compose ps
echo ""

# Check URLs
echo "=================================================="
echo "🌐 Service URLs Health Check"
echo "=================================================="

check_url "https://app.promolinxy.online" "Frontend"
check_url "https://backend.promolinxy.online/health" "Backend API"
check_url "https://builder.promolinxy.online" "Typebot Builder"
check_url "https://bot.promolinxy.online" "Typebot Viewer"
check_url "https://n8n.promolinxy.online" "N8N"

echo ""

# Check internal services
echo "=================================================="
echo "🔍 Internal Services Check"
echo "=================================================="

echo "Checking PostgreSQL connections..."
docker compose exec -T postgres-saas pg_isready -U saasbot && echo -e "${GREEN}✓ PostgreSQL (SaaS) is ready${NC}" || echo -e "${RED}✗ PostgreSQL (SaaS) is not ready${NC}"
docker compose exec -T postgres-typebot pg_isready -U typebot && echo -e "${GREEN}✓ PostgreSQL (Typebot) is ready${NC}" || echo -e "${RED}✗ PostgreSQL (Typebot) is not ready${NC}"

echo ""
echo "Checking Redis..."
docker compose exec -T redis redis-cli ping | grep -q "PONG" && echo -e "${GREEN}✓ Redis is ready${NC}" || echo -e "${RED}✗ Redis is not ready${NC}"

echo ""

# Check disk space
echo "=================================================="
echo "💾 Disk Space"
echo "=================================================="
df -h | grep -E "Filesystem|/$" 

echo ""

# Check logs for errors
echo "=================================================="
echo "📋 Recent Errors (Last 10 minutes)"
echo "=================================================="
docker compose logs --since 10m 2>&1 | grep -i "error" | tail -20 || echo -e "${GREEN}No recent errors found${NC}"

echo ""
echo "=================================================="
echo "Health check complete!"
echo "=================================================="
