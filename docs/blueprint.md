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

### 2.1 Current Launch Architecture

VeryFastChat is currently in a launch-ready architecture phase:

- the web app renders the product UI and subscribes to realtime room updates
- the FastAPI service owns writes, moderation actions, and authenticated server-side logic
- Supabase acts as the system of record for rooms, participants, messages, and profiles
- Supabase Realtime pushes message and presence updates to connected clients
- Redis is optional and currently used only for shared rate limiting if enabled

This is the right level of complexity for the current product because it keeps:

- the request path simple
- operational overhead low
- deployment and debugging straightforward

### 2.2 Architecture Evolution

#### Phase 1: Launch Architecture

This is the current production shape and is appropriate for launch:

- single frontend application
- single backend API service
- Supabase-backed persistence and realtime fanout
- optional Redis for rate limiting
- minimal coordination overhead between components

This phase works well as long as:

- the API can handle write traffic directly
- most side effects stay synchronous
- realtime fanout is handled acceptably by Supabase Realtime

#### Phase 2: Introduce an Event Layer

An event bus or messaging layer should be introduced only when the system starts showing pressure that justifies asynchronous processing or service decoupling.

Typical triggers:

- multiple API instances coordinating work
- background workers
- push notifications
- analytics processing
- moderation pipelines
- search indexing

At that point, the event layer separates user-facing API latency from background work and allows multiple consumers to react to the same domain event.

Typical additions in this phase:

- queue or event bus
- worker processes
- explicit event schemas for room, message, and user actions

#### Phase 3: Large-Scale Distributed Architecture

This phase begins when the system needs independent scaling, stronger isolation, and more specialized infrastructure.

Typical characteristics:

- separate chat, moderation, analytics, or indexing services
- dedicated asynchronous pipelines
- more advanced observability and tracing
- independent read/write concerns
- stronger fault isolation between subsystems

This phase should be driven by real scale or organizational complexity, not by premature architecture expansion.

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
