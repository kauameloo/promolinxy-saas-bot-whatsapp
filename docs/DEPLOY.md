# Guia de Deploy

## Deploy na Vercel (Frontend)

1. Conecte seu repositório GitHub à Vercel
2. Configure as variáveis de ambiente:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CAKTO_WEBHOOK_SECRET`
3. Deploy automático a cada push

## Deploy do WhatsApp Engine (VPS)

O WhatsApp Engine precisa de um servidor dedicado devido ao Puppeteer.

### Requisitos

- Ubuntu 20.04+ ou Debian 11+
- 2GB RAM mínimo
- Docker e Docker Compose

### Passos

1. Configure o servidor:
\`\`\`bash
# Atualiza o sistema
sudo apt update && sudo apt upgrade -y

# Instala Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instala Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
\`\`\`

2. Clone e configure:
\`\`\`bash
git clone https://github.com/seu-usuario/saasbot-whatsapp.git
cd saasbot-whatsapp
cp .env.example .env
nano .env  # Configure suas variáveis
\`\`\`

3. Inicie os serviços:
\`\`\`bash
docker-compose up -d
\`\`\`

4. Verifique os logs:
\`\`\`bash
docker-compose logs -f
\`\`\`

## Configuração de SSL

Para HTTPS, use Certbot:

\`\`\`bash
sudo apt install certbot
sudo certbot certonly --standalone -d seu-dominio.com
\`\`\`

Copie os certificados para `docker/ssl/` e descomente as configurações HTTPS no nginx.conf.

## Monitoramento

Use PM2 para monitorar o WhatsApp Engine:

\`\`\`bash
docker exec -it saasbot-whatsapp pm2 monit
\`\`\`

## Backup

Configure backup automático do PostgreSQL:

\`\`\`bash
# Cria script de backup
cat > /opt/backup.sh << 'EOF'
#!/bin/bash
docker exec saasbot-postgres pg_dump -U saasbot saasbot > /backup/saasbot_$(date +%Y%m%d).sql
find /backup -name "*.sql" -mtime +7 -delete
EOF
chmod +x /opt/backup.sh

# Agenda no cron
echo "0 2 * * * /opt/backup.sh" | crontab -
