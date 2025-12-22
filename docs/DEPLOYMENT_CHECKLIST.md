# Deployment Checklist - API 500 Errors Fix

## Pre-Deployment Verification

Before deploying the fixes to production, ensure you have completed these steps:

### 1. Environment Variables Setup

- [ ] Set `DATABASE_URL` in your `.env` file or environment
- [ ] Set `JWT_SECRET` (minimum 64 characters) in your `.env` file
- [ ] Set `NEXT_PUBLIC_API_URL` to your production URL (e.g., `https://www.promolinxy.online`)
- [ ] Verify all environment variables are accessible in your deployment environment

### 2. Database Verification

- [ ] Confirm database is accessible from your deployment environment
- [ ] Verify database schema is up to date:
  \`\`\`bash
  psql "YOUR_DATABASE_URL" -f scripts/001-create-database-schema.sql
  \`\`\`
- [ ] Test database connection manually:
  \`\`\`bash
  psql "YOUR_DATABASE_URL" -c "SELECT 1;"
  \`\`\`

### 3. Docker Configuration (for Docker deployments)

- [ ] Update `.env` file with production values
- [ ] Verify `NEXT_PUBLIC_API_URL` is set correctly in `.env`
- [ ] Review `docker-compose.yml` build args configuration
- [ ] Ensure Dockerfiles are in the root directory (not docker/ subdirectory)

## Deployment Steps

### Option A: Docker Compose Deployment (VPS)

1. **Stop existing containers**:
   \`\`\`bash
   docker-compose down
   \`\`\`

2. **Pull latest code**:
   \`\`\`bash
   git pull origin main
   \`\`\`

3. **Rebuild containers** (with no cache for clean build):
   \`\`\`bash
   docker-compose build --no-cache frontend
   \`\`\`

4. **Start services**:
   \`\`\`bash
   docker-compose up -d
   \`\`\`

5. **Verify deployment**:
   \`\`\`bash
   docker-compose logs -f frontend
   docker-compose ps
   \`\`\`

### Option B: Manual Deployment

1. **Pull latest code**:
   \`\`\`bash
   git pull origin main
   \`\`\`

2. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

3. **Build the application**:
   \`\`\`bash
   NEXT_PUBLIC_API_URL=https://www.promolinxy.online npm run build
   \`\`\`

4. **Start the application**:
   \`\`\`bash
   npm run start
   \`\`\`

### Option C: Vercel Deployment

1. **Update environment variables in Vercel dashboard**:
   - Navigate to your project settings
   - Go to "Environment Variables"
   - Add/update `NEXT_PUBLIC_API_URL` with your backend URL
   - Add/update `DATABASE_URL` with your database connection string
   - Add/update `JWT_SECRET` with your secret key

2. **Deploy**:
   - Push to your git repository, or
   - Trigger manual deploy from Vercel dashboard

## Post-Deployment Verification

### 1. Health Checks

Test each API endpoint that was previously failing:

\`\`\`bash
# Replace with your actual domain and auth token
BASE_URL="https://www.promolinxy.online"
AUTH_TOKEN="your-jwt-token-here"

# Test login (get a token first)
curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saasbot.com","password":"admin123"}'

# Test stats endpoint
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  "$BASE_URL/api/dashboard/stats"

# Test chart endpoint
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  "$BASE_URL/api/dashboard/chart?days=7"

# Test events endpoint
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  "$BASE_URL/api/events?limit=5"

# Test auth/me endpoint
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  "$BASE_URL/api/auth/me"
\`\`\`

### 2. Frontend Verification

- [ ] Open your application in a browser
- [ ] Login with valid credentials
- [ ] Verify dashboard loads without errors
- [ ] Check browser console for any API errors
- [ ] Verify all stats and charts display correctly

### 3. Error Monitoring

- [ ] Check application logs for any errors:
  \`\`\`bash
  # For Docker deployment
  docker-compose logs -f frontend
  
  # For PM2 deployment
  pm2 logs
  \`\`\`

- [ ] Monitor server response times
- [ ] Check for any 500 errors in access logs

## Rollback Plan

If issues occur after deployment:

### Docker Deployment Rollback

1. **Stop current deployment**:
   \`\`\`bash
   docker-compose down
   \`\`\`

2. **Checkout previous version**:
   \`\`\`bash
   git log --oneline  # Find the commit hash before the changes
   git checkout <previous-commit-hash>
   \`\`\`

3. **Rebuild and restart**:
   \`\`\`bash
   docker-compose build --no-cache
   docker-compose up -d
   \`\`\`

### Manual Deployment Rollback

1. **Stop the application**
2. **Checkout previous version**
3. **Rebuild and restart**

## Common Issues and Solutions

### Issue: Still getting 500 errors

**Solutions**:
1. Check Docker logs: `docker-compose logs frontend`
2. Verify DATABASE_URL is set correctly in the container: `docker-compose exec frontend env | grep DATABASE_URL`
3. Test database connection from container: `docker-compose exec frontend psql $DATABASE_URL -c "SELECT 1;"`
4. Ensure database schema is up to date

### Issue: Frontend shows "Network Error"

**Solutions**:
1. Verify NEXT_PUBLIC_API_URL is correct
2. Check if URL was embedded at build time: `grep -r "promolinxy.online" .next/static`
3. Rebuild the frontend if URL changed: `docker-compose build --no-cache frontend`
4. Check CORS configuration if using separate API domain

### Issue: Database connection timeout

**Solutions**:
1. Verify database server is running
2. Check firewall rules allow connections from your app server
3. Verify DATABASE_URL includes correct host, port, and SSL settings
4. Test connection from app server: `psql "YOUR_DATABASE_URL" -c "SELECT 1;"`

### Issue: Environment variables not available

**Solutions**:
1. Verify .env file exists and is readable
2. Check docker-compose.yml has environment variables configured
3. Restart containers after changing environment variables
4. For NEXT_PUBLIC_* vars, remember to rebuild (not just restart)

## Security Checklist

- [ ] JWT_SECRET is at least 64 characters and random
- [ ] DATABASE_URL is not logged or exposed in errors
- [ ] Default admin password has been changed from "admin123"
- [ ] NODE_ENV is set to "production" in production
- [ ] Database credentials are stored securely (environment variables, not in code)
- [ ] HTTPS is enabled for production deployments
- [ ] Firewall rules limit database access to application servers only

## Success Criteria

Deployment is considered successful when:

- [ ] All API endpoints return 200 OK or expected status codes (no 500 errors)
- [ ] Dashboard loads and displays data correctly
- [ ] Users can login successfully
- [ ] Charts and statistics display without errors
- [ ] No critical errors in application logs
- [ ] Application responds within acceptable time limits (< 2 seconds)

## Support

If issues persist after following this checklist:

1. Review the detailed fix documentation: `docs/API_500_ERRORS_FIX.md`
2. Check the application logs for specific error messages
3. Verify each component of the stack is running correctly
4. Test database connection independently
5. Consult the troubleshooting section in the fix documentation
