# =====================================================
# Makefile - Simplified Commands
# =====================================================

.PHONY: help setup deploy status logs restart stop clean health backup

# Default target
help:
	@echo "======================================================"
	@echo "🚀 PromoLinxy SaaS Bot - VPS Commands"
	@echo "======================================================"
	@echo ""
	@echo "Available commands:"
	@echo "  make setup       - Initial VPS setup (run once)"
	@echo "  make deploy      - Deploy all services"
	@echo "  make status      - Show services status"
	@echo "  make logs        - Show all logs (live)"
	@echo "  make restart     - Restart all services"
	@echo "  make stop        - Stop all services"
	@echo "  make clean       - Remove containers and images"
	@echo "  make health      - Run health check"
	@echo "  make backup      - Backup databases"
	@echo ""
	@echo "Service-specific logs:"
	@echo "  make logs-frontend"
	@echo "  make logs-backend"
	@echo "  make logs-caddy"
	@echo "  make logs-n8n"
	@echo "  make logs-typebot"
	@echo ""

# Initial setup (run once)
setup:
	@echo "Running initial VPS setup..."
	@chmod +x deploy/setup-vps.sh
	@sudo deploy/setup-vps.sh

# Deploy all services
deploy:
	@echo "Deploying services..."
	@chmod +x deploy/deploy.sh
	@./deploy/deploy.sh

# Show status
status:
	@echo "Services status:"
	@docker compose ps

# Show all logs (live)
logs:
	@docker compose logs -f

# Show frontend logs
logs-frontend:
	@docker compose logs -f frontend

# Show backend logs
logs-backend:
	@docker compose logs -f whatsapp-engine

# Show Caddy logs
logs-caddy:
	@docker compose logs -f caddy

# Show N8N logs
logs-n8n:
	@docker compose logs -f n8n

# Show Typebot logs
logs-typebot:
	@docker compose logs -f typebot-builder typebot-viewer

# Restart all services
restart:
	@echo "Restarting all services..."
	@docker compose restart

# Restart specific service
restart-%:
	@echo "Restarting $*..."
	@docker compose restart $*

# Stop all services
stop:
	@echo "Stopping all services..."
	@docker compose down

# Clean everything (dangerous!)
clean:
	@echo "⚠️  WARNING: This will remove all containers and images!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds..."
	@sleep 5
	@docker compose down -v
	@docker system prune -af

# Run health check
health:
	@echo "Running health check..."
	@chmod +x deploy/health-check.sh
	@./deploy/health-check.sh

# Backup databases
backup:
	@echo "Creating database backups..."
	@mkdir -p backups
	@docker compose exec -T postgres-saas pg_dump -U saasbot saasbot > backups/backup-saas-$$(date +%Y%m%d-%H%M%S).sql
	@docker compose exec -T postgres-typebot pg_dump -U typebot typebot > backups/backup-typebot-$$(date +%Y%m%d-%H%M%S).sql
	@echo "✅ Backups created in ./backups/"

# Update services
update:
	@echo "Updating services..."
	@docker compose pull
	@docker compose up -d --build
	@docker image prune -f

# Validate configuration
validate:
	@echo "Validating configuration..."
	@docker compose config --quiet && echo "✅ Configuration is valid"
