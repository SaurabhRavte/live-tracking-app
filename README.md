# LiveTrack — Real-Time Location Tracking System

A production-grade real-time location sharing system built with **Socket.IO**, **Kafka**, **PostgreSQL**, **Vite + TypeScript**, **Express**, and **Leaflet**.

## Demo Video

> 📽️ [YouTube Demo Link — add after recording](https://youtube.com)

---

## Architecture Overview

```
Browser (Vite + Leaflet)
     │
     │  Socket.IO (JWT auth)
     ▼
Express + Socket.IO Server
     │
     │  publishLocationEvent()
     ▼
Kafka Topic: location-events
     │
     ├─── Consumer Group 1: socket-broadcaster
     │         └── io.emit("location:update") → all browsers
     │
     └─── Consumer Group 2: location-db-writer
               └── INSERT INTO location_history (idempotent)
```

### Why Kafka?

| Without Kafka | With Kafka |
|---|---|
| Every socket event → direct DB write | Socket handler just enqueues (<1ms) |
| DB becomes bottleneck at scale | DB consumer processes at sustainable rate |
| Socket failure = data loss | Kafka retains events for replay |
| Hard to add more processors | Add consumer groups independently |
| No deduplication | event_id ensures idempotency |

Consumer groups mean the socket broadcaster and DB writer are completely independent — one can crash without affecting the other.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, TypeScript, Tailwind CSS, Leaflet |
| Backend | Express, Socket.IO, TypeScript |
| Auth | JWT, Passport.js, Google OAuth 2.0 |
| Message Queue | Apache Kafka (via KafkaJS) |
| Database | PostgreSQL 16 |
| Containerization | Docker, Docker Compose |
| Proxy | Nginx |

---

## Project Structure

```
live-tracker/
├── docker-compose.yml          # Full production stack
├── docker-compose.dev.yml      # Dev infra only (Kafka + Postgres)
├── package.json                # Root scripts
│
├── client/                     # Vite + TypeScript frontend
│   ├── src/
│   │   ├── assets/main.css     # Tailwind entry
│   │   ├── components/
│   │   │   ├── UserSidebar.ts  # Live users panel
│   │   │   └── Toast.ts        # Notifications
│   │   ├── lib/
│   │   │   ├── auth.ts         # JWT + API helpers
│   │   │   ├── map.ts          # Leaflet manager
│   │   │   ├── router.ts       # Hash SPA router
│   │   │   └── socket.ts       # Socket.IO client
│   │   ├── pages/
│   │   │   ├── LoginPage.ts    # Register + Login + Google
│   │   │   ├── AppPage.ts      # Main map view
│   │   │   └── AuthCallbackPage.ts
│   │   ├── types/index.ts
│   │   └── main.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
│
└── server/                     # Express + Socket.IO backend
    ├── src/
    │   ├── config/env.ts        # Environment config
    │   ├── kafka/
    │   │   ├── producer.ts      # Kafka producer
    │   │   ├── socketConsumer.ts # Consumer Group 1
    │   │   └── dbConsumer.ts    # Consumer Group 2
    │   ├── middleware/auth.ts   # JWT middleware
    │   ├── routes/
    │   │   ├── auth.ts          # Register, login, Google OAuth
    │   │   └── location.ts      # Location history API
    │   ├── services/db.ts       # PostgreSQL queries
    │   ├── socket/server.ts     # Socket.IO server + auth
    │   ├── types/index.ts
    │   └── index.ts             # Entry point
    ├── sql/init.sql             # DB schema
    └── Dockerfile
```

---

## Local Setup

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker + Docker Compose

### Step 1 — Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/live-tracker
cd live-tracker

# Install all dependencies
pnpm install:all
```

### Step 2 — Environment variables

```bash
# Server
cp server/.env.example server/.env

# Client
cp client/.env.example client/.env
```

Edit `server/.env`:
```env
PORT=4000
DATABASE_URL=postgresql://tracker:tracker_secret@localhost:5432/tracker_db
KAFKA_BROKERS=localhost:29092
JWT_SECRET=your_strong_secret_here
SESSION_SECRET=another_strong_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CLIENT_URL=http://localhost:5173
```

Edit `client/.env`:
```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Step 3 — Start infrastructure (Kafka + Postgres)

```bash
pnpm infra:up
```

Wait ~15 seconds for Kafka to be ready. Check:
```bash
pnpm infra:logs
```

### Step 4 — Run backend and frontend

In two terminals:

```bash
# Terminal 1 — Backend
pnpm server:dev

# Terminal 2 — Frontend
pnpm client:dev
```

Open http://localhost:5173

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **Google+ API** or **Google Identity**
4. Go to **Credentials → Create OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - Development: `http://localhost:4000/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
7. Copy Client ID and Secret to your `.env` files

---

## Docker Deployment (Production)

### Option A — All-in-one on a single server

```bash
# Create .env at root (or export directly)
cat > .env << EOF
JWT_SECRET=change_this_strong_secret
SESSION_SECRET=change_this_other_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CLIENT_URL=http://YOUR_SERVER_IP
CLIENT_API_URL=http://YOUR_SERVER_IP/api
CLIENT_SOCKET_URL=http://YOUR_SERVER_IP
EOF

# Build and start everything
pnpm docker:up

# View logs
pnpm docker:logs
```

Services:
- Frontend: `http://YOUR_SERVER_IP` (port 80)
- Backend: `http://YOUR_SERVER_IP:4000`
- Kafka: internal only

### Option B — Deploy to Railway / Render / Fly.io

1. **Database**: Use Railway PostgreSQL or Supabase
2. **Kafka**: Use [Confluent Cloud](https://confluent.io) free tier
   - Get bootstrap server URL (format: `pkc-xxx.region.aws.confluent.cloud:9092`)
   - Set `KAFKA_BROKERS` to this URL
3. **Backend**: Deploy `server/` as a Node.js service
4. **Frontend**: Deploy `client/` as a static site (Vercel/Netlify)
   - Build command: `pnpm build`
   - Output dir: `dist`

### Environment variables for production backend

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@host:5432/db
KAFKA_BROKERS=your-confluent-bootstrap-server:9092
JWT_SECRET=<strong random string>
SESSION_SECRET=<strong random string>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-api.com/api/auth/google/callback
CLIENT_URL=https://your-frontend.com
```

---

## Socket Event Flow

```
Client                          Server
  │                                │
  │── connect (auth: {token}) ────►│  verify JWT, attach user to socket
  │                                │
  │◄─ users:snapshot ──────────────│  all currently live users
  │                                │
  │── location:send {lat,lng} ────►│  validate → publish to Kafka
  │                                │
  │                    Kafka Consumer (socket-broadcaster)
  │◄─ location:update ─────────────│  broadcast to all connected clients
  │                                │
  │── location:stop ───────────────►  remove from live map
  │                                │
  │── disconnect ──────────────────►  remove from live map + notify others
```

---

## Kafka Event Flow

```
Socket.IO Server
  └─► publishLocationEvent(event) → Kafka topic: location-events
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
              Consumer Group:                    Consumer Group:
              socket-broadcaster                 location-db-writer
                              │                               │
                  io.emit("location:update")    INSERT INTO location_history
                  to all Socket.IO clients      ON CONFLICT (event_id) DO NOTHING
```

**Consumer groups** mean Kafka delivers each message to **both** consumers independently. Adding a third consumer (e.g., analytics, geofencing) requires zero changes to existing code.

---

## Assumptions and Limitations

- **Stale users**: Removed from map after 30 seconds without a location update
- **Location interval**: Frontend sends every 5 seconds while sharing
- **Single Kafka broker**: Production should use 3 brokers for HA
- **In-memory live user store**: For multi-server deployments, use Redis
- **Google OAuth**: Requires valid credentials — email/password auth works without them
- **HTTPS**: Required for `getCurrentPosition` on production domains (not localhost)
- **Session store**: Uses memory store in dev; use `connect-pg-simple` in production
- **Deduplication**: Handled via `event_id` (UUID) with `ON CONFLICT DO NOTHING`

---

## Key Design Decisions

### User identity via JWT, not socket ID

Socket IDs change on reconnect. The system always identifies users by their JWT `sub` (userId), so reconnecting users resume seamlessly and the correct marker is updated on the map.

### Two consumer groups, one topic

`socket-broadcaster` and `location-db-writer` both read from `location-events` with different group IDs. Kafka delivers each event to both independently — they can scale, fail, and replay independently.

### Kafka fallback

If Kafka is unavailable (e.g., first startup), the socket server falls back to direct `io.emit()` so the app still works. A warning is logged.
