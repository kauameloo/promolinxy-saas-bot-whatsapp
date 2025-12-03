#!/bin/bash

# =====================================================
# Setup Script - VPS Deployment
# =====================================================
# This script will prepare your VPS environment for deployment

set -e

echo "=================================================="
echo "🚀 PromoLinxy SaaS Bot - VPS Setup"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Running as root${NC}"
echo ""

# Step 1: Update system packages
echo "=================================================="
echo "📦 Step 1: Updating system packages..."
echo "=================================================="
apt-get update
apt-get upgrade -y
echo -e "${GREEN}✓ System packages updated${NC}"
echo ""

# Step 2: Install Docker
echo "=================================================="
echo "🐳 Step 2: Installing Docker..."
echo "=================================================="

if command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker is already installed${NC}"
    docker --version
else
    # Install prerequisites
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    echo -e "${GREEN}✓ Docker installed successfully${NC}"
    docker --version
fi
echo ""

# Step 3: Start Docker service
echo "=================================================="
echo "🔧 Step 3: Starting Docker service..."
echo "=================================================="
systemctl start docker
systemctl enable docker
echo -e "${GREEN}✓ Docker service started and enabled${NC}"
echo ""

# Step 4: Create project directory
echo "=================================================="
echo "📁 Step 4: Creating project directory..."
echo "=================================================="

PROJECT_DIR="/root/stack"
if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    echo -e "${GREEN}✓ Created directory: $PROJECT_DIR${NC}"
else
    echo -e "${YELLOW}⚠ Directory already exists: $PROJECT_DIR${NC}"
fi
echo ""

# Step 5: Create required subdirectories
echo "=================================================="
echo "📂 Step 5: Creating required subdirectories..."
echo "=================================================="

cd "$PROJECT_DIR"

# Remove Caddyfile directory if it exists (common error)
if [ -d "./Caddyfile" ]; then
    echo -e "${YELLOW}⚠ Removing Caddyfile directory (it should be a file)${NC}"
    rm -rf ./Caddyfile
fi

# Create data directories
mkdir -p ./pgdata
mkdir -p ./postgres-saas
mkdir -p ./caddy_data
mkdir -p ./caddy_config
mkdir -p ./n8n
mkdir -p ./promolinxy-saas-bot-whatsapp/scripts

echo -e "${GREEN}✓ Required subdirectories created${NC}"
echo ""

# Step 6: Set proper permissions
echo "=================================================="
echo "🔐 Step 6: Setting permissions..."
echo "=================================================="
chmod -R 755 ./caddy_data ./caddy_config ./n8n
chmod -R 700 ./pgdata ./postgres-saas
echo -e "${GREEN}✓ Permissions set${NC}"
echo ""

# Step 7: Check firewall
echo "=================================================="
echo "🔥 Step 7: Checking firewall..."
echo "=================================================="

if command -v ufw &> /dev/null; then
    echo "Configuring UFW firewall..."
    ufw --force enable
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 443/udp   # HTTPS (HTTP/3)
    ufw reload
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ UFW not found. Make sure ports 80, 443 are open${NC}"
fi
echo ""

# Step 8: Create .env file if doesn't exist
echo "=================================================="
echo "📝 Step 8: Creating .env file..."
echo "=================================================="

if [ ! -f "$PROJECT_DIR/.env" ]; then
    touch "$PROJECT_DIR/.env"
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${YELLOW}⚠ Remember to configure your environment variables in .env${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
fi
echo ""

# Summary
echo "=================================================="
echo "✅ Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Clone or upload your project files to: $PROJECT_DIR"
echo "2. Copy the following files to $PROJECT_DIR:"
echo "   - docker-compose.yml"
echo "   - Caddyfile"
echo "   - .env (configure with your values)"
echo "3. Copy the database schema to: $PROJECT_DIR/promolinxy-saas-bot-whatsapp/scripts/"
echo "4. Run: cd $PROJECT_DIR && docker compose up -d"
echo ""
echo "📍 Current directory: $PROJECT_DIR"
echo ""
