# API 500 Internal Server Errors - Fix Documentation

## Problem Summary

The application was experiencing 500 Internal Server Errors on the following API endpoints:
- `GET /api/events?limit=5`
- `GET /api/dashboard/chart?days=7`
- `GET /api/dashboard/stats`
- `GET /api/auth/me`

## Root Causes Identified

### 1. Incorrect Neon Database Driver Usage

**Issue**: The database helper functions in `lib/db.ts` were calling `.query()` method on the Neon serverless SQL instance, but the Neon driver doesn't expose a `.query()` method. Instead, it should be called directly as a function.

**Fix**: Updated the `query()` and `remove()` functions to use the correct Neon driver API:

```typescript
// Before (INCORRECT):
const result = await sqlInstance.query(queryText, params)

// After (CORRECT):
const result = await sqlInstance(queryText, params || [])
```

### 2. Missing Build-Time Environment Variables

**Issue**: The `NEXT_PUBLIC_API_URL` environment variable was not being passed at Docker build time. Next.js requires `NEXT_PUBLIC_*` variables to be available during the build process because they get embedded into the frontend bundle.

**Fix**: Updated `Dockerfile.frontend` to accept `NEXT_PUBLIC_API_URL` as a build argument:

```dockerfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
```

And updated `docker-compose.yml` to pass the build argument:

```yaml
frontend:
  build:
    context: .
    dockerfile: Dockerfile.frontend
    args:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3000}
```

### 3. Insufficient Error Logging

**Issue**: The API routes were catching errors but not providing detailed error information, making debugging difficult.

**Fix**: Enhanced error handling in all affected API routes to log detailed error messages and return error details in development mode:

```typescript
catch (error) {
  console.error("API error:", error)
  const errorMessage = error instanceof Error ? error.message : "Error message"
  return NextResponse.json({ 
    success: false, 
    error: errorMessage,
    details: process.env.NODE_ENV === "development" ? String(error) : undefined
  }, { status: 500 })
}
```

## Files Modified

1. **lib/db.ts**
   - Fixed `query()` function to use Neon driver correctly
   - Fixed `remove()` function to use Neon driver correctly
   - Added detailed error logging

2. **app/api/events/route.ts**
   - Enhanced error handling with detailed logging

3. **app/api/dashboard/chart/route.ts**
   - Enhanced error handling with detailed logging

4. **app/api/dashboard/stats/route.ts**
   - Enhanced error handling with detailed logging

5. **app/api/auth/me/route.ts**
   - Enhanced error handling with detailed logging

6. **Dockerfile.frontend**
   - Added ARG and ENV for NEXT_PUBLIC_API_URL

7. **docker-compose.yml**
   - Added build args to pass NEXT_PUBLIC_API_URL
   - Fixed Dockerfile paths (they're in root, not docker/ directory)

## Deployment Instructions

### For VPS Deployment with Docker Compose

1. **Update your `.env` file** to include the public API URL:
   ```bash
   # For production deployment
   NEXT_PUBLIC_API_URL=https://www.promolinxy.online
   
   # Or if API is on a different domain
   NEXT_PUBLIC_API_URL=https://api.promolinxy.online
   ```

2. **Rebuild the Docker containers** with the new configuration:
   ```bash
   # Stop existing containers
   docker-compose down
   
   # Rebuild with no cache to ensure clean build
   docker-compose build --no-cache frontend
   
   # Start the services
   docker-compose up -d
   ```

3. **Verify the deployment**:
   ```bash
   # Check container logs
   docker-compose logs -f frontend
   
   # Test the API endpoints
   curl https://www.promolinxy.online/api/dashboard/stats
   ```

### For Vercel Deployment (Frontend Only)

If deploying the frontend to Vercel:

1. **Set environment variable in Vercel dashboard**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add `NEXT_PUBLIC_API_URL` with your VPS backend URL (e.g., `https://api.promolinxy.online`)

2. **Redeploy** the project from Vercel dashboard

### For Local Development

1. **Update `.env` file**:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3000
   DATABASE_URL=your-database-connection-string
   JWT_SECRET=your-secret-key
   ```

2. **Install dependencies and run**:
   ```bash
   npm install
   npm run dev
   ```

## Testing the Fix

After deployment, test each endpoint:

```bash
# Replace with your actual domain
BASE_URL="https://www.promolinxy.online"

# Test stats endpoint (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" $BASE_URL/api/dashboard/stats

# Test chart endpoint (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" "$BASE_URL/api/dashboard/chart?days=7"

# Test events endpoint (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" "$BASE_URL/api/events?limit=5"

# Test auth/me endpoint (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" $BASE_URL/api/auth/me
```

## Additional Notes

### Database Connection
- Ensure your `DATABASE_URL` environment variable is correctly set and accessible from the Docker container
- The connection string should be in the format: `postgresql://user:password@host:port/database?sslmode=require`
- For Neon PostgreSQL, make sure to include `?sslmode=require` at the end
- **Security Warning**: Never log or expose database connection strings with credentials. Always use environment variables and secure secrets management.

### Environment Variables Priority
- `NEXT_PUBLIC_API_URL` is embedded at build time and cannot be changed at runtime
- If you need to change this URL, you must rebuild the frontend container/application
- Store sensitive environment variables (JWT_SECRET, DATABASE_URL) securely and never commit them to version control

### Security Considerations
- The enhanced error logging includes detailed error information in development mode only
- Query parameters are only logged in development to prevent exposure of sensitive data
- In production (`NODE_ENV=production`), only user-friendly error messages are returned
- Always use strong values for `JWT_SECRET` in production (minimum 64 characters)
- Never expose database credentials in logs, error messages, or configuration files

## Troubleshooting

### If you still see 500 errors:

1. **Check Docker logs**:
   ```bash
   docker-compose logs frontend
   ```

2. **Verify DATABASE_URL is set correctly**:
   ```bash
   docker-compose exec frontend env | grep DATABASE_URL
   ```

3. **Test database connection manually**:
   ```bash
   # Connect to the database using psql or your preferred client
   psql "YOUR_DATABASE_URL"
   ```

4. **Check if tables exist**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

5. **Ensure the database schema is up to date**:
   ```bash
   psql "YOUR_DATABASE_URL" -f scripts/001-create-database-schema.sql
   ```

## Monitoring

To monitor the application health:

1. **Set up log aggregation** to collect error logs from Docker containers
2. **Monitor API response times** and error rates
3. **Set up alerts** for repeated 500 errors
4. **Review database query performance** using your database provider's dashboard

## Future Improvements

Consider these enhancements:
1. Add health check endpoints that test database connectivity
2. Implement retry logic for transient database errors
3. Add database connection pooling configuration
4. Set up automated database backups
5. Implement structured logging with log levels
