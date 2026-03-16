# VeryFastChat

VeryFastChat is a real-time chat app where anyone can create a room, share a link instantly, and keep conversations going with persistent chat history.

Anonymous use is supported by default. Sign-in is optional and adds persistent room ownership, profiles, and cross-device access.

## Stack

| Layer               | Tech                                         |
| ------------------- | -------------------------------------------- |
| Web                 | Next.js 14 (App Router, TypeScript)          |
| API                 | FastAPI (Python 3.11+)                       |
| Database & Realtime | Supabase (Postgres + Realtime)               |
| Auth                | Supabase Auth (email/password, Google OAuth) |
| Rate Limiting       | Upstash Redis (in-memory fallback)           |

## Repo Layout

```
apps/
  web/          Next.js frontend
  api/          FastAPI backend
docs/
  blueprint.md              Architecture & data model
  deployment.md             Deployment guide (Render, Fly.io, Docker)
  production-checklist.md   Launch checklist
```

## Features

- Create and join rooms via shareable link — no account required
- Real-time messaging via Supabase Realtime
- Persistent rooms (no auto-expiration, host ends when done)
- Host moderation: lock, unlock, end room, delete messages
- Optional authentication with email/password and Google OAuth
- User profiles with display name and avatar
- "My Rooms" dashboard for authenticated users
- Rate limiting per action (create, join, send)
- PWA support with offline fallback
- Dark / light / system theme

## Current Status

- Supabase is already provisioned and connected for this project
- Production is live:
  - Web: `https://veryfastchat.vercel.app`
  - API: `https://veryfastchat-api.onrender.com`
- Local verification is green:
  - Backend: `83/83` tests passing
  - Frontend: `37/37` Playwright tests passing
- CI is configured with GitHub Actions for backend tests and frontend builds
- Scheduled production monitoring is configured with GitHub Actions

## Local Development

### API

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env   # fill in Supabase credentials + SESSION_SECRET
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Web

```bash
cd apps/web
npm install
cp .env.example .env   # fill in Supabase + API URL
npm run dev
```

Open http://localhost:3000

### Shortcuts

```bash
make api   # start API with hot reload
make web   # start Next.js dev server
```

## Testing

```bash
# Backend
cd apps/api && pip install -e ".[dev]" && pytest

# Frontend
cd apps/web && npx playwright test
```

## CI And Monitoring

- `/.github/workflows/ci.yml`
  - Runs `pytest` for `/Users/srujayreddy/Projects/VeryFastChat/apps/api`
  - Runs `next build` for `/Users/srujayreddy/Projects/VeryFastChat/apps/web`
- `/.github/workflows/monitoring.yml`
  - Checks the production web app every 30 minutes
  - Checks `GET /health` on the production API
  - Uses only public endpoints, so no GitHub secrets are required

## Deployment

See [docs/deployment.md](docs/deployment.md) for full instructions (Vercel + Render/Fly.io/Docker).

## Documentation

| Doc                                                  | Purpose                                |
| ---------------------------------------------------- | -------------------------------------- |
| [Blueprint](docs/blueprint.md)                       | Architecture, data model, API contract |
| [Deployment](docs/deployment.md)                     | Deploy to production                   |
| [Production Checklist](docs/production-checklist.md) | Pre/post-launch verification           |
