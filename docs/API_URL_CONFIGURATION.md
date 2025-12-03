# API URL Configuration

This document explains how to configure the frontend to call a different backend API server using the `NEXT_PUBLIC_API_URL` environment variable.

## Problem Statement

Previously, all API calls were hardcoded to `/api/...` which would always route to the frontend's own API routes. This caused issues when deploying the frontend and backend separately, as the frontend would try to call its own routes instead of the backend server.

For example:
- Frontend deployed at: `https://www.promolinxy.online`
- Backend deployed at: `https://api.promolinxy.online`
- API call: `/api/auth/login` would incorrectly call `https://www.promolinxy.online/api/auth/login` (frontend)
- Should call: `https://api.promolinxy.online/api/auth/login` (backend)

## Solution

All API calls now use the `NEXT_PUBLIC_API_URL` environment variable to construct full API URLs. This allows you to specify where the backend API server is located.

## Configuration

### 1. Set Environment Variable

Add the following to your `.env` file or environment configuration:

```bash
# For local development (default)
NEXT_PUBLIC_API_URL=http://localhost:3000

# For production with separate backend
NEXT_PUBLIC_API_URL=https://api.promolinxy.online
```

### 2. Deployment Instructions

#### Local Development
No configuration needed! The default value will work automatically.

#### Vercel Deployment
1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add a new variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://api.promolinxy.online`
4. Click **Save**
5. Redeploy your project

#### Docker Deployment
Add the environment variable to your `docker-compose.yml`:

```yaml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://api.promolinxy.online
```

## How It Works

### Architecture

All API calls now go through utility functions that automatically prepend the `NEXT_PUBLIC_API_URL`:

1. **`lib/utils/api-url.ts`**: Core utility functions
   - `getApiBaseUrl()`: Gets the base API URL from environment or defaults
   - `getApiUrl(path)`: Constructs full API URLs

2. **`lib/hooks/use-api.ts`**: Updated API hooks
   - `useApi()`: SWR hook for GET requests
   - `apiPost()`: POST requests
   - `apiPut()`: PUT requests
   - `apiDelete()`: DELETE requests

3. **`lib/hooks/use-auth.ts`**: Updated authentication
   - `login()`: Login function
   - `checkAuth()`: Auth verification

### Example Usage

All existing code continues to work without changes:

```typescript
// In your components
const { data, isLoading } = useApi<User[]>("/api/users")

// Will automatically call:
// - Local: http://localhost:3000/api/users
// - Production: https://api.promolinxy.online/api/users
```

## Benefits

1. **Flexible Deployment**: Frontend and backend can be deployed separately
2. **Environment-specific Configuration**: Different URLs for dev, staging, and production
3. **Backwards Compatible**: Defaults to current origin if not configured
4. **Centralized Logic**: All API URL construction in one place
5. **Type-safe**: Full TypeScript support

## Troubleshooting

### Issue: API calls still going to wrong URL

**Solution**: Make sure `NEXT_PUBLIC_API_URL` is set correctly and rebuild your application.

```bash
# Rebuild to pick up environment variable changes
npm run build
```

### Issue: CORS errors

**Solution**: Configure CORS on your backend to allow requests from your frontend domain:

```javascript
// Backend server
app.use(cors({
  origin: 'https://www.promolinxy.online',
  credentials: true
}))
```

### Issue: Environment variable not working

**Solution**: Make sure the variable starts with `NEXT_PUBLIC_` prefix. Next.js only exposes environment variables to the browser that start with this prefix.

## Testing

### Test Local Setup
1. Start backend: `npm run start:backend`
2. Start frontend: `npm run dev`
3. Login at `http://localhost:3000`
4. Check browser Network tab - calls should go to `http://localhost:3000/api/...`

### Test Production Setup
1. Set `NEXT_PUBLIC_API_URL=https://api.promolinxy.online`
2. Build: `npm run build`
3. Start: `npm run start`
4. Login and check Network tab - calls should go to `https://api.promolinxy.online/api/...`

## Migration Checklist

- [x] Add `NEXT_PUBLIC_API_URL` to `.env.example`
- [x] Create `lib/utils/api-url.ts` utility
- [x] Update `lib/hooks/use-api.ts` to use new utility
- [x] Update `lib/hooks/use-auth.ts` to use new utility
- [x] Test build succeeds
- [x] Test local development
- [ ] Deploy to production
- [ ] Verify API calls in production
- [ ] Update deployment documentation

## Security Considerations

1. **Always use HTTPS in production**: `NEXT_PUBLIC_API_URL=https://api.promolinxy.online`
2. **Keep backend URL secret if needed**: Although `NEXT_PUBLIC_*` variables are exposed to the browser, ensure your backend has proper authentication
3. **Configure CORS properly**: Only allow requests from trusted domains
4. **Use environment-specific variables**: Different URLs for dev, staging, and production
