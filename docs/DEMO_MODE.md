# Demo Mode - Temporary Login Bypass

⚠️ **This is a temporary development feature. Do NOT use in production.**

## Overview

Demo Mode bypasses authentication checks and provides mock data for testing and demonstrations. All auth guards are disabled and API calls return mock responses.

## Files Modified

### Backend (NestJS)

1. **`backend-nest/src/auth/guards/jwt-auth.guard.ts`**
   - Auto-attaches mock user to all requests
   - Skips JWT token validation
   - DEMO_MODE env var (defaults to true)

2. **`backend-nest/src/auth/guards/optional-jwt-auth.guard.ts`**
   - Always returns mock user
   - No token required

3. **`backend-nest/src/auth/guards/roles.guard.ts`**
   - Allows ADMIN access for demo user
   - All role checks bypass for ADMIN role

4. **`backend-nest/src/security/guards/permission.guard.ts`**
   - Allows all permissions for demo user

5. **`backend-nest/src/auth/auth.controller.ts`**
   - `POST /auth/login` - Returns mock token and user
   - `POST /auth/register` - Returns mock token and user
   - DEMO_MODE flag for login/register endpoints

### Frontend (Next.js)

1. **`frontend/src/stores/auth-store.ts`**
   - DEMO_MODE = true
   - Auto-authenticated on startup
   - Mock user: `demo@example.com`
   - Mock subscription: PRO plan

2. **`frontend/src/lib/api.ts`**
   - DEMO_MODE = true
   - All auth endpoints return mock responses
   - Mock projects list (3 demo projects)
   - Mock subscription data
   - Mock checkout/portal URLs

## Mock Data

### Mock User
```json
{
  "id": "demo-user-123",
  "email": "demo@example.com",
  "name": "Demo User",
  "organizationId": "demo-org-123",
  "role": "ADMIN"
}
```

### Mock Subscription
```json
{
  "id": "demo-sub-123",
  "userId": "demo-user-123",
  "plan": "PRO",
  "status": "ACTIVE",
  "currentPeriodStart": "<today>",
  "currentPeriodEnd": "<30 days from now>"
}
```

### Mock Projects
- **Demo Project 1**: "Welcome to Demo Presentation Designer"
- **Demo Project 2**: "Marketing Campaign Presentation"
- **Demo Project 3**: "Q1 Business Review"

## Features Working in Demo Mode

✅ **Frontend**
- Auto-login (no credentials needed)
- Dashboard access
- Project creation (returns mock project)
- Project listing
- Subscription info
- User profile
- Navigation

✅ **Backend**
- Login endpoint (returns mock token)
- Register endpoint (returns mock token)
- Profile endpoint (returns mock user)
- All admin endpoints (ADMIN role granted)
- All protected routes (auth bypassed)

## How to Disable Demo Mode

### For Backend
Edit `backend-nest/src/auth/guards/jwt-auth.guard.ts` and set:
```typescript
private readonly DEMO_MODE = process.env.DEMO_MODE === 'true' || false;  // Change to false
```

Or set environment variable:
```bash
export DEMO_MODE=false
```

### For Frontend
Edit `frontend/src/stores/auth-store.ts` and set:
```typescript
const DEMO_MODE = false;  // Change to false
```

Also edit `frontend/src/lib/api.ts`:
```typescript
const DEMO_MODE = false;  // Change to false
```

## Testing with Real Auth

To test real authentication while keeping demo mode features:

1. **Disable frontend demo mode only** - Tests real backend auth
2. **Disable backend demo mode only** - Tests real frontend with enforced auth
3. **Disable both** - Tests entire real auth flow

## API Responses with Demo Mode

All API calls are mocked:

```typescript
// login
POST /auth/login → { accessToken, refreshToken, user }

// register
POST /auth/register → { accessToken, refreshToken, user }

// get profile
GET /auth/me → User object

// get projects
GET /projects → { items: [MOCK_PROJECT, ...], total: 3 }

// get subscription
GET /users/subscription → MOCK_SUBSCRIPTION

// create project
POST /projects → { id: "demo-project-123", ... }

// generate project
POST /projects/generate → { status: "queued", jobId: "demo-job-123" }
```

## Environment Variables

```bash
# Backend
DEMO_MODE=true  # Default: true (can be overridden in code)

# Frontend
# Edit in source files (no env var for frontend demo mode)
```

## Important Notes

⚠️ **Remember to disable before production deployment!**

- All auth is bypassed - no real credentials needed
- No database access for auth validation
- All users have ADMIN privileges
- Perfect for demos, UI testing, and development
- Does NOT break actual login/API infrastructure
- Original auth services remain intact
- Can be toggled per environment

## Testing Checklist

- [ ] Login page (auto-skips to dashboard)
- [ ] Dashboard loads with mock projects
- [ ] Create new project works
- [ ] Project editor loads
- [ ] Admin endpoints accessible
- [ ] Subscription info displays
- [ ] Profile page works
- [ ] Logout and login again works

## Reverting to Production

Simply set `DEMO_MODE = false` in:
1. `backend-nest/src/auth/guards/*.ts` files
2. `frontend/src/stores/auth-store.ts`
3. `frontend/src/lib/api.ts`

All tests and login flows will require real credentials and JWT validation.
