# VeryFastChat deployment

## Overview

- **Web (Next.js)** → Vercel
- **API (FastAPI)** → Render, Fly.io, or Docker
- **Database & Realtime** → Supabase (already set up)
- **Rate limiting** → Upstash Redis (optional; in-memory fallback)

## Current State

- Supabase is already provisioned for this project
- The app has been verified locally against the live Supabase configuration
- Deployment work is focused on hosting the API and web app with production env vars

---

## 1. Web app (Vercel)

1. Push your repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Set **Root Directory** to `apps/web` (or use a monorepo preset if applicable).
3. Configure environment variables:

   | Variable                        | Value                                                    |
   | ------------------------------- | -------------------------------------------------------- |
   | `NEXT_PUBLIC_API_BASE_URL`      | Your API base URL (e.g. `https://your-api.onrender.com`) |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                     |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                                        |
   | `NEXT_PUBLIC_SENTRY_DSN`        | Optional browser Sentry DSN                              |

4. Deploy. Vercel will build and serve the Next.js app.

---

## 2. API Deployment Options

### Option A: Render (Recommended)

1. In [Render](https://render.com), create a **Web Service**.
2. Connect the same GitHub repo.
3. Set **Root Directory** to `apps/api` (if applicable).
4. **Build command**: `pip install -e .`
5. **Start command**: `./start.sh` or `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4`
6. Add environment variables (see below)

### Option B: Fly.io

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/)
2. From `apps/api` directory:
   ```bash
   fly launch
   fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SESSION_SECRET=...
   fly deploy
   ```

### Option C: Docker (Any Platform)

1. Build the image:

   ```bash
   cd apps/api
   docker build -t veryfastchat-api .
   ```

2. Run locally:

   ```bash
   docker run -p 8000:8000 \
     -e SUPABASE_URL=... \
     -e SUPABASE_SERVICE_ROLE_KEY=... \
     -e SESSION_SECRET=... \
     veryfastchat-api
   ```

3. Deploy to any Docker-compatible platform (AWS ECS, Google Cloud Run, etc.)

---

## 3. Required Environment Variables

### API Environment Variables

| Variable                    | Required | Description                            | Example                          |
| --------------------------- | -------- | -------------------------------------- | -------------------------------- |
| `SUPABASE_URL`              | ✅ Yes   | Supabase project URL                   | `https://xxx.supabase.co`        |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes   | Supabase service role key              | `<your-service-role-key>`        |
| `SESSION_SECRET`            | ✅ Yes   | Random string for session cookies      | Generate: `openssl rand -hex 32` |
| `WEB_APP_URL`               | ✅ Yes   | Your frontend URL                      | `https://your-app.vercel.app`    |
| `CORS_ORIGINS`              | ✅ Yes   | Allowed CORS origins (comma-separated) | `https://your-app.vercel.app`    |
| `API_ENV`                   | No       | Environment name                       | `production`                     |
| `METRICS_SECRET`            | No       | Secret for /metrics endpoint           | Random string                    |
| `SENTRY_DSN`                | No       | Server-side Sentry DSN                 | From Sentry project settings     |
| `SENTRY_TRACES_SAMPLE_RATE` | No       | API trace sampling rate                | `0` to `1.0`                     |
| `UPSTASH_REDIS_REST_URL`    | No       | Redis URL for rate limiting            | From Upstash dashboard           |
| `UPSTASH_REDIS_REST_TOKEN`  | No       | Redis token                            | From Upstash dashboard           |

**Generate SESSION_SECRET:**

```bash
openssl rand -hex 32
```

---

## 4. CORS Configuration

The API uses `CORS_ORIGINS` (comma-separated). Default is `http://localhost:3000,http://127.0.0.1:3000`.

For production, set:

```bash
CORS_ORIGINS=https://your-app.vercel.app,https://www.your-app.com
```

---

## 5. Health Checks

The API includes a comprehensive health check endpoint:

```bash
curl https://your-api.onrender.com/health
```

Response:

```json
{
  "status": "ok",
  "checks": {
    "api": "ok",
    "database": "ok",
    "redis": "not_configured"
  }
}
```

Configure your platform to use `/health` for:

- Load balancer health checks
- Container orchestration health probes
- Uptime monitoring

---

## 6. Monitoring & Metrics

### Metrics Endpoint

`GET /metrics` returns usage statistics:

```bash
curl https://your-api.onrender.com/metrics \
  -H "X-Metrics-Secret: YOUR_SECRET"
```

Response:

```json
{
  "status": "ok",
  "counts": {
    "rooms_created": 1234,
    "joins": 5678,
    "messages_sent": 12345,
    "rooms_deleted": 42
  }
}
```

### Logging

The API logs all requests with timing:

```
INFO: POST /v1/rooms 200 45.2ms
INFO: GET /v1/rooms/abc123 200 12.3ms
```

For production, consider:

- Structured JSON logging
- Log aggregation (Datadog, Logtail, etc.)
- Error tracking (Sentry)

### Sentry Setup

This repo supports optional Sentry integration for both services:

- web:
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
  - `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
- API:
  - `SENTRY_DSN`
  - `SENTRY_TRACES_SAMPLE_RATE`

### GitHub Actions Monitoring

This repo includes `/.github/workflows/monitoring.yml`, which:

- checks `https://veryfastchat.vercel.app`
- checks `https://veryfastchat-api.onrender.com/health`
- uses only public endpoints, so no GitHub repository secrets are required

`/metrics` remains available for authorized operational use, but it is intentionally not queried from GitHub Actions.

---

## 7. Performance Tuning

### Uvicorn Workers

Default: 4 workers (set via `WORKERS` env var)

Recommended formula: `(2 x CPU cores) + 1`

```bash
# For 2 CPU cores
WORKERS=5

# For 4 CPU cores
WORKERS=9
```

### Timeout Settings

Default keep-alive: 30 seconds

Adjust in `start.sh` or Dockerfile CMD:

```bash
--timeout-keep-alive 30
```

---

## 8. Security Checklist

- [x] `SESSION_SECRET` is random and secure (32+ characters)
- [x] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to frontend
- [x] CORS is configured for production domains only
- [x] `METRICS_SECRET` is set for production
- [x] HTTPS is enabled (handled by Vercel/Render)
- [x] Rate limiting is configured (Redis recommended for production)
- [x] Environment variables are stored securely (not in code)

---

## 9. Scaling Considerations

### Horizontal Scaling

- API is stateless and can scale horizontally
- Use Redis for rate limiting across multiple instances
- Supabase handles database scaling automatically

### Vertical Scaling

- Start with 1-2 CPU cores, 512MB-1GB RAM
- Monitor CPU and memory usage
- Scale up if response times increase

### Database

- Supabase free tier: 500MB database, 2GB bandwidth
- Upgrade to Pro for production workloads
- Enable connection pooling for high traffic

---

## 10. Deployment Checklist

### Pre-Deploy

- [ ] All tests passing (`pytest`, `npx playwright test`)
- [ ] Environment variables configured
- [ ] Supabase target environment is provisioned and matches the app schema
- [ ] CORS origins set correctly
- [ ] SESSION_SECRET generated

### Deploy API

- [ ] API deployed and accessible
- [ ] `/health` endpoint returns 200
- [ ] `/metrics` endpoint protected (if secret set)
- [ ] Logs show successful startup

### Deploy Web

- [ ] Frontend deployed to Vercel
- [ ] `NEXT_PUBLIC_API_BASE_URL` points to API
- [ ] Can create and join rooms
- [ ] Real-time messaging works
- [ ] PWA manifest configured

### Post-Deploy

- [ ] Test full user flow (create → join → chat)
- [ ] Monitor error rates and response times
- [x] Set up uptime monitoring
- [ ] Configure alerts for health check failures

---

## 11. Troubleshooting

### API won't start

- Check logs for missing environment variables
- Verify Supabase connection with `/health` endpoint
- Ensure `SESSION_SECRET` is set

### CORS errors in browser

- Add frontend URL to `CORS_ORIGINS`
- Ensure no trailing slashes in URLs
- Check browser console for exact error

### Rate limiting not working

- Verify `UPSTASH_REDIS_REST_URL` and token are set
- Check Redis connection in `/health` endpoint
- Falls back to in-memory if Redis unavailable

### Real-time not working

- Verify Supabase Realtime is enabled for `messages` table
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Ensure RLS policies allow SELECT on messages

---

## 12. Cost Estimates

### Free Tier (Development)

- Vercel: Free (hobby plan)
- Render: Free (with limitations)
- Supabase: Free (500MB database)
- Upstash: Free (10K commands/day)

**Total: $0/month**

### Production (Low Traffic)

- Vercel: $20/month (Pro)
- Render: $7/month (Starter)
- Supabase: $25/month (Pro)
- Upstash: $10/month (Pay-as-you-go)

**Total: ~$62/month**

### Production (High Traffic)

- Vercel: $20/month
- Render: $25/month (Standard)
- Supabase: $25-100/month
- Upstash: $10-50/month

**Total: ~$80-195/month**
