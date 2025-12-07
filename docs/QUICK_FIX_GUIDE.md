# Quick Fix Guide - API 500 Errors

## TL;DR - What Changed

Fixed 3 critical issues causing API 500 errors:
1. ✅ Database query methods now use correct Neon driver syntax
2. ✅ Docker build now passes `NEXT_PUBLIC_API_URL` at build time
3. ✅ Better error logging (development only for sensitive data)

## Quick Deploy (Docker Compose)

\`\`\`bash
# 1. Update your .env file
cat >> .env << EOF
NEXT_PUBLIC_API_URL=https://www.promolinxy.online
DATABASE_URL=your-database-connection-string
JWT_SECRET=your-secret-key-min-64-chars
EOF

# 2. Stop, rebuild, and restart
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d

# 3. Verify
docker-compose logs -f frontend
\`\`\`

## Quick Test

\`\`\`bash
# Replace with your domain
curl https://www.promolinxy.online/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saasbot.com","password":"admin123"}'
\`\`\`

If you get a token back (not a 500 error), the fix worked! 🎉

## What Files Changed

- `lib/db.ts` - Fixed database driver usage
- `app/api/*/route.ts` - Enhanced error handling (4 files)
- `Dockerfile.frontend` - Added build-time env var
- `docker-compose.yml` - Added build args
- `.env.example` - Better documentation

## Key Point

⚠️ **IMPORTANT**: `NEXT_PUBLIC_API_URL` is embedded at **BUILD TIME**, not runtime!

If you change this variable, you **MUST REBUILD**:
\`\`\`bash
docker-compose build --no-cache frontend
# or
npm run build
\`\`\`

## Still Having Issues?

1. Check logs: `docker-compose logs frontend`
2. Verify env vars: `docker-compose exec frontend env | grep -E "(DATABASE|API|JWT)"`
3. Test database: `psql "$DATABASE_URL" -c "SELECT 1;"`
4. See full docs: [`docs/API_500_ERRORS_FIX.md`](./API_500_ERRORS_FIX.md)

## Need Help?

See detailed troubleshooting in:
- [`docs/API_500_ERRORS_FIX.md`](./API_500_ERRORS_FIX.md) - Full technical documentation
- [`docs/DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) - Step-by-step deployment guide
