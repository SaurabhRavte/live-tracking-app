# LiveTrack — Real-Time Location Tracking System

A production-grade real-time location sharing system built with **Socket.IO**, **Kafka**, **PostgreSQL**, **Vite + TypeScript**, **Express**, and **Leaflet**.

## Demo Video

> 📽️ [YouTube Demo Link — add after recording](https://youtube.com)

---

## Architecture Overview

```
Browser (Vite + Leaflet)
     │
     │  Socket.IO (Clerk auth)
     ▼
Express + Socket.IO Server
     │
     │  publishLocationEvent()
     ▼
Kafka Topic: location-events  (optional — falls back to direct io.emit if unavailable)
     │
     ├─── Consumer Group 1: socket-broadcaster
     │         └── io.emit("location:update") → all browsers
     │
     └─── Consumer Group 2: location-db-writer
               └── INSERT INTO location_history (idempotent)
```

### Why Kafka?

| Without Kafka                        | With Kafka                                |
| ------------------------------------ | ----------------------------------------- |
| Every socket event → direct DB write | Socket handler just enqueues (<1ms)       |
| DB becomes bottleneck at scale       | DB consumer processes at sustainable rate |
| Socket failure = data loss           | Kafka retains events for replay           |
| Hard to add more processors          | Add consumer groups independently         |
| No deduplication                     | event_id ensures idempotency              |

> **Note:** Kafka is optional. If `KAFKA_BROKERS` is not set, the app automatically falls back to direct `io.emit()` and still works perfectly.

---

## Tech Stack

| Layer            | Technology                              |
| ---------------- | --------------------------------------- |
| Frontend         | Vite, TypeScript, Tailwind CSS, Leaflet |
| Backend          | Express, Socket.IO, TypeScript          |
| Auth             | Clerk                                   |
| Message Queue    | Apache Kafka (via KafkaJS) — optional   |
| Database         | PostgreSQL 16                           |
| Containerization | Docker, Docker Compose                  |

---

## Project Structure

```
live-tracking-app/
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
│   │   │   ├── map.ts          # Leaflet manager
│   │   │   ├── router.ts       # Hash SPA router
│   │   │   └── socket.ts       # Socket.IO client
│   │   ├── pages/
│   │   │   ├── LoginPage.ts
│   │   │   └── AppPage.ts      # Main map view
│   │   ├── types/index.ts
│   │   └── main.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
│
└── server/                     # Express + Socket.IO backend
    ├── src/
    │   ├── config/env.ts
    │   ├── kafka/
    │   │   ├── producer.ts
    │   │   ├── socketConsumer.ts
    │   │   └── dbConsumer.ts
    │   ├── middleware/auth.ts
    │   ├── routes/
    │   │   └── location.ts
    │   ├── services/db.ts
    │   ├── socket/server.ts
    │   ├── types/index.ts
    │   └── index.ts
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
git clone https://github.com/SaurabhRavte/live-tracking-app
cd live-tracking-app
pnpm install:all
```

### Step 2 — Environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env`:

```env
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://tracker:tracker_secret@localhost:5432/tracker_db

# Kafka (optional — remove this line to use Socket.IO fallback)
KAFKA_BROKERS=localhost:29092

# Clerk — get from https://dashboard.clerk.com → API Keys
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173
```

Edit `client/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
```

### Step 3 — Start infrastructure (Kafka + Postgres)

```bash
pnpm infra:up
```

Wait ~15 seconds for Kafka to be ready, then check logs:

```bash
pnpm infra:logs
```

### Step 4 — Run backend and frontend

```bash
# Terminal 1 — Backend
pnpm server:dev

# Terminal 2 — Frontend
pnpm client:dev
```

Open http://localhost:5173

---

## Clerk Auth Setup

This project uses [Clerk](https://clerk.com) for authentication.

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) and create a free account
2. Click **"Create Application"** → give it a name → choose login methods (Email recommended)
3. Go to **API Keys** from the left sidebar
4. Copy:
   - **Secret Key** (starts with `sk_test_...`) → goes in `server/.env` as `CLERK_SECRET_KEY`
   - **Publishable Key** (starts with `pk_test_...`) → goes in `client/.env` as `VITE_CLERK_PUBLISHABLE_KEY`

---

## 🚀 Production Deployment (Railway + Vercel — Free)

This is the recommended free hosting setup:

| Part                | Platform                                 | Cost      |
| ------------------- | ---------------------------------------- | --------- |
| Backend (Node.js)   | Railway                                  | Free tier |
| PostgreSQL Database | Railway                                  | Free tier |
| Frontend (Vite)     | Vercel                                   | Free      |
| Kafka               | Not needed — app uses Socket.IO fallback | —         |

### Step 1 — Deploy Backend on Railway

1. Go to [railway.app](https://railway.app) → sign up with GitHub
2. Click **"New Project" → "Deploy from GitHub repo"** → select `live-tracking-app`
3. In the service **Settings**, set **Root Directory** to `/server`
4. Railway will auto-detect Node.js and build it

### Step 2 — Add PostgreSQL on Railway

1. In your Railway project, click **"+ Add" → "Database" → "PostgreSQL"**
2. After it's created, click the PostgreSQL service → **Variables** tab
3. Copy the `DATABASE_URL` value

### Step 3 — Initialize the Database

1. Click the PostgreSQL service → **"Query"** tab
2. Open `server/sql/init.sql` from this repo
3. Paste the contents and click **Run** — this creates all required tables

### Step 4 — Set Backend Environment Variables

Click your backend service → **Variables** tab → add these:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=<paste from Railway PostgreSQL>
CLERK_SECRET_KEY=<your Clerk secret key>
CLIENT_URL=<your Vercel frontend URL — fill after Step 6>
```

> ⚠️ Do **not** add `KAFKA_BROKERS` — the app will automatically use Socket.IO fallback mode.

### Step 5 — Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → sign up with GitHub
2. Click **"New Project"** → import `live-tracking-app`
3. Set **Root Directory** to `client`
4. Set **Build Command** to `pnpm build`
5. Set **Output Directory** to `dist`
6. Add these **Environment Variables**:

```env
VITE_API_URL=https://<your-railway-backend-url>
VITE_SOCKET_URL=https://<your-railway-backend-url>
VITE_CLERK_PUBLISHABLE_KEY=<your Clerk publishable key>
```

7. Click **Deploy**

### Step 6 — Update CLIENT_URL in Railway

Once Vercel gives you a frontend URL:

1. Go back to Railway → backend service → **Variables**
2. Update `CLIENT_URL` to your Vercel URL (e.g. `https://live-tracking-app.vercel.app`)
3. Railway will auto-redeploy

### Step 7 — Update Clerk Allowed Origins

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → your app
2. Go to **"Domains"** → add your Vercel frontend URL
3. This allows Clerk to work on your production domain ✅

Your app is now live! 🎉

---

## Socket Event Flow

```
Client                          Server
  │                                │
  │── connect (Clerk token) ──────►│  verify token, attach user to socket
  │                                │
  │◄─ users:snapshot ──────────────│  all currently live users
  │                                │
  │── location:send {lat,lng} ────►│  validate → publish to Kafka (or direct emit)
  │                                │
  │◄─ location:update ─────────────│  broadcast to all connected clients
  │                                │
  │── location:stop ───────────────►  remove from live map
  │                                │
  │── disconnect ──────────────────►  remove from live map + notify others
```

---

## Kafka Event Flow (when Kafka is configured)

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

---

## Assumptions and Limitations

- **Stale users**: Removed from map after 30 seconds without a location update
- **Location interval**: Frontend sends every 5 seconds while sharing
- **Single Kafka broker**: Production should use 3 brokers for HA
- **In-memory live user store**: For multi-server deployments, use Redis
- **HTTPS**: Required for `getCurrentPosition` on production domains (not localhost)
- **Deduplication**: Handled via `event_id` (UUID) with `ON CONFLICT DO NOTHING`

---

## Key Design Decisions

### Clerk for Auth

Clerk handles all authentication (email/password, social login, session management) out of the box — no need to manage JWTs or OAuth flows manually.

### Kafka is Optional

If `KAFKA_BROKERS` is not set, the server falls back to direct `io.emit()`. This means you can deploy without any Kafka setup and the real-time tracking still works. Kafka only becomes necessary at scale.

### Two consumer groups, one topic

`socket-broadcaster` and `location-db-writer` both read from `location-events` with different group IDs. Kafka delivers each event to both independently — they can scale, fail, and replay independently.
