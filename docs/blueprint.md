# VeryFastChat Blueprint

## 1. Product Boundaries

- Anonymous rooms via share link — no account required
- Optional authentication (email/password, Google OAuth)
- Real-time messages + presence
- Persistent rooms (host ends when done, no auto-expiration)
- Host moderation: lock, unlock, end room, delete messages
- Rate limiting per action
- PWA with offline fallback

## 2. System Architecture

- Next.js 14 (App Router) serves room UX, auth flows, and link-sharing
- FastAPI manages room lifecycle, moderation, auth, and server-authoritative actions
- Supabase Postgres stores rooms, participants, messages, and user profiles
- Supabase Auth handles JWT-based authentication
- Supabase Realtime distributes chat events to subscribed room channels
- Upstash Redis tracks rate limits (in-memory fallback when unconfigured)

## 3. Data Model

### rooms

| Column          | Type               | Notes                             |
| --------------- | ------------------ | --------------------------------- |
| id              | uuid pk            |                                   |
| slug            | text unique        | Public room ID in URL             |
| room_name       | text               | Optional display name             |
| room_image_url  | text               | Optional room avatar              |
| host_token_hash | text               | SHA-256 hashed host token         |
| user_id         | uuid fk auth.users | Nullable — set when authenticated |
| status          | text               | `active`, `locked`, `ended`       |
| created_at      | timestamptz        |                                   |
| expires_at      | timestamptz null   | Always null (persistent rooms)    |

### participants

| Column       | Type               | Notes                        |
| ------------ | ------------------ | ---------------------------- |
| id           | uuid pk            |                              |
| room_id      | uuid fk rooms.id   | CASCADE delete               |
| session_id   | text               | Anonymous session identifier |
| display_name | text               |                              |
| is_host      | bool               |                              |
| user_id      | uuid fk auth.users | Nullable                     |
| joined_at    | timestamptz        |                              |
| last_seen_at | timestamptz        |                              |

### messages

| Column         | Type                    | Notes          |
| -------------- | ----------------------- | -------------- |
| id             | uuid pk                 |                |
| room_id        | uuid fk rooms.id        | CASCADE delete |
| participant_id | uuid fk participants.id | CASCADE delete |
| body           | text                    |                |
| created_at     | timestamptz             |                |
| deleted_at     | timestamptz null        | Soft delete    |

### profiles

| Column       | Type                  | Notes                     |
| ------------ | --------------------- | ------------------------- |
| id           | uuid pk fk auth.users |                           |
| display_name | text                  | 1-50 characters           |
| avatar_url   | text                  | HTTPS only, max 500 chars |
| created_at   | timestamptz           |                           |
| updated_at   | timestamptz           | Auto-updated via trigger  |

## 4. API Endpoints

### Infrastructure

- `GET /health` — dependency-verified health check
- `GET /metrics` — usage counters (protected by secret)

### Room Lifecycle

- `POST /v1/rooms` — create room (optional auth)
- `GET /v1/rooms/{slug}` — room details + participant count
- `POST /v1/rooms/{slug}/join` — join room (optional auth)

### Messaging

- `GET /v1/rooms/{slug}/messages` — list messages (supports `?since=`)
- `POST /v1/rooms/{slug}/messages` — send message (rate-limited)
- `DELETE /v1/rooms/{slug}/messages/{id}` — delete message (author or host)

### Moderation (host only)

- `POST /v1/rooms/{slug}/moderation/lock` — lock room
- `POST /v1/rooms/{slug}/moderation/unlock` — unlock room
- `POST /v1/rooms/{slug}/moderation/end` — end and delete room

### Auth & Profile

- `GET /v1/auth/profile` — get current user profile
- `POST /v1/auth/profile` — create or update profile
- `GET /v1/auth/rooms` — list user's owned rooms

## 5. Authentication

Dual authorization model:

- Authenticated users: JWT in `Authorization: Bearer <token>`, verified via Supabase Auth
- Anonymous users: host_token (SHA-256 hashed) stored in sessionStorage

Host verification checks user_id match first, then falls back to host_token.
All endpoints accept anonymous access unless explicitly protected.

## 6. Realtime Events (Supabase)

Channel: `room:{room_slug}`

Events: `presence:sync`, `presence:join`, `presence:leave`, `message:new`, `message:deleted`, `room:locked`, `room:ended`

## 7. Security

- HttpOnly session cookies (`SameSite=Lax`, secure in production)
- Host tokens hashed with SHA-256, never exposed to clients
- Rate limiting defaults: 10 rooms/min, 30 joins/min, 60 messages/min per IP
- Rate limits are configurable through API environment variables for local verification and ops tuning
- Input validation via Pydantic with length limits
- CORS restricted to configured origins
- RLS on all tables; anon key allows SELECT only
- Service role key used server-side only

## 8. Deployment

- Web: Vercel
- API: Render, Fly.io, or Docker
- Database: Supabase managed project
- Redis: Upstash (optional)

See [deployment.md](deployment.md) for detailed instructions.
