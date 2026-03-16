# veryfastchat-api

FastAPI service for room lifecycle, moderation, and integrations with Supabase + Redis.

## Features

- **Room Management**: Create, join, and manage persistent chat rooms
- **Real-time Messaging**: Send and receive messages with Supabase Realtime
- **Rate Limiting**: Per-action rate limits with Redis or in-memory fallback
- **Session Management**: Secure HttpOnly cookies for authentication
- **Host Moderation**: Lock rooms, end rooms, delete messages
- **Monitoring**: Health checks, metrics, and request logging
- **Production Ready**: Docker support, environment validation, comprehensive tests

## Quick Start

### Development

```bash
# Install dependencies
pip install -e .

# Or with uv (faster)
uv pip install -e .

# Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Testing

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html
```

### Docker

```bash
# Build image
docker build -t veryfastchat-api .

# Run container
docker run -p 8000:8000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e SESSION_SECRET=... \
  veryfastchat-api
```

## API Endpoints

### Infrastructure

- `GET /health` - Health check with dependency verification
- `GET /metrics` - Usage metrics (protected by secret)

### Room Lifecycle

- `POST /v1/rooms` - Create a new room
- `GET /v1/rooms/{slug}` - Get room details
- `POST /v1/rooms/{slug}/join` - Join a room

### Messaging

- `GET /v1/rooms/{slug}/messages` - List messages
- `POST /v1/rooms/{slug}/messages` - Send a message
- `DELETE /v1/rooms/{slug}/messages/{id}` - Delete a message

### Moderation

- `POST /v1/rooms/{slug}/moderation/lock` - Lock room (host only)
- `POST /v1/rooms/{slug}/moderation/end` - End and delete room (host only)

## Rate Limits

The API applies per-action rate limiting (see `app/rate_limit.py`). When configured with Upstash Redis it uses a shared store; otherwise an in-memory sliding window is used per key (e.g. IP).

| Action       | Limit  | 429 Response                               |
| ------------ | ------ | ------------------------------------------ |
| Create room  | 10/min | "Too many rooms created. Try again later." |
| Join room    | 30/min | "Too many join attempts. Try again later." |
| Send message | 60/min | "Too many messages. Slow down."            |

The web app shows a user-friendly message on 429 and supports retry.

## Environment Variables

### Required

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (keep secret!)
- `SESSION_SECRET` - Random string for session cookies (generate with `openssl rand -hex 32`)

### Optional

- `API_ENV` - Environment name (default: `development`)
- `API_HOST` - Host to bind to (default: `0.0.0.0`)
- `API_PORT` - Port to listen on (default: `8000`)
- `CREATE_ROOM_RATE_LIMIT` - Max room creations per window (default: `10`)
- `JOIN_RATE_LIMIT` - Max joins per window (default: `30`)
- `SEND_MESSAGE_RATE_LIMIT` - Max messages per window (default: `60`)
- `RATE_LIMIT_WINDOW_SECONDS` - Shared rate-limit window size in seconds (default: `60`)
- `WEB_APP_URL` - Frontend URL for CORS and share links (default: `http://localhost:3000`)
- `CORS_ORIGINS` - Comma-separated allowed origins (default: `http://localhost:3000,http://127.0.0.1:3000`)
- `METRICS_SECRET` - Secret for `/metrics` endpoint (if unset, endpoint is public)
- `SENTRY_DSN` - Optional Sentry DSN for API error tracking
- `SENTRY_TRACES_SAMPLE_RATE` - Optional trace sample rate for Sentry
- `UPSTASH_REDIS_REST_URL` - Redis URL for distributed rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - Redis authentication token

## Architecture

```
┌─────────────┐
│   Next.js   │ ← Users
│   Frontend  │
└──────┬──────┘
       │ HTTP + WebSocket
       ↓
┌─────────────┐
│   FastAPI   │
│     API     │
└──────┬──────┘
       │
       ├─→ Supabase (Postgres + Realtime)
       └─→ Upstash Redis (Rate Limiting)
```

## Deployment

See [docs/deployment.md](../../docs/deployment.md) for detailed deployment instructions.

### Quick Deploy Options

**Render**: One-click deploy with automatic HTTPS
**Fly.io**: Global edge deployment with `fly launch`
**Docker**: Deploy anywhere with container support

## Monitoring

### Health Check

```bash
curl https://your-api.com/health
```

Returns:

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

### Metrics

```bash
curl https://your-api.com/metrics \
  -H "X-Metrics-Secret: YOUR_SECRET"
```

Returns:

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

## Security

- **Session Cookies**: HttpOnly, SameSite=Lax, secure in production
- **Host Tokens**: SHA-256 hashed, never exposed to clients
- **Rate Limiting**: Per-IP and per-session limits
- **CORS**: Configurable allowed origins
- **Input Validation**: Pydantic schemas with length limits
- **SQL Injection**: Protected by Supabase client parameterization

## Development

### Project Structure

```
apps/api/
├── app/
│   ├── main.py           # FastAPI app and middleware
│   ├── config.py         # Settings and environment
│   ├── db.py             # Supabase client
│   ├── schemas.py        # Pydantic models
│   ├── session.py        # Session cookie management
│   ├── rate_limit.py     # Rate limiting logic
│   ├── metrics.py        # Usage metrics
│   └── routes/
│       └── rooms.py      # Room endpoints
├── tests/
│   ├── conftest.py       # Test fixtures
│   ├── test_health.py    # Health/metrics tests
│   └── test_rooms.py     # Room endpoint tests
├── Dockerfile            # Container image
├── start.sh              # Production startup script
├── pyproject.toml        # Dependencies
└── pytest.ini            # Test configuration
```

### Adding New Endpoints

1. Define schemas in `app/schemas.py`
2. Add route in `app/routes/` or create new router
3. Include router in `app/main.py`
4. Add tests in `tests/`
5. Update this README

### Code Style

- Follow PEP 8
- Use type hints
- Document functions with docstrings
- Keep functions small and focused

## Troubleshooting

### API won't start

- Check environment variables are set
- Verify Supabase connection
- Check logs for detailed error messages

### Rate limiting not working

- Verify Redis credentials if using Upstash
- Check `/health` endpoint for Redis status
- Falls back to in-memory if Redis unavailable

### CORS errors

- Add frontend URL to `CORS_ORIGINS`
- Ensure no trailing slashes
- Check browser console for exact error

## License

See [LICENSE](../../LICENSE) in repository root.
