# LiveTrack — Real-Time Location Tracking System

A production-grade real-time location sharing system built with **Socket.IO**, **Kafka**, **PostgreSQL**, **Vite + TypeScript**, **Express** and **Leaflet**.

## Screenshots

> ![DEMO1](./screenshot/one.png)
> ![DEMO2](./screenshot/two.png)

---

## Demo Video

> 📽️ https://www.youtube.com/watch?v=Eu5CDSd_ivI

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
