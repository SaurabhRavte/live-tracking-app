import { Pool } from "pg";
import { config } from "../config/env";
import { User } from "../types";

const pool = new Pool({
  connectionString: config.db.url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err.message);
});

export async function connectDb(): Promise<void> {
  const client = await pool.connect();
  console.log("[DB] Connected to PostgreSQL");
  client.release();
}

// ─── User Queries ──────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<User | null> {
  const res = await pool.query(
    `SELECT id, email, name, avatar_url, provider, provider_id, created_at, updated_at
     FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (!res.rows[0]) return null;
  return mapUser(res.rows[0]);
}

export async function findUserById(id: string): Promise<User | null> {
  const res = await pool.query(
    `SELECT id, email, name, avatar_url, provider, provider_id, created_at, updated_at
     FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!res.rows[0]) return null;
  return mapUser(res.rows[0]);
}

export async function findUserByProviderId(
  provider: string,
  providerId: string
): Promise<User | null> {
  const res = await pool.query(
    `SELECT id, email, name, avatar_url, provider, provider_id, created_at, updated_at
     FROM users WHERE provider = $1 AND provider_id = $2 LIMIT 1`,
    [provider, providerId]
  );
  if (!res.rows[0]) return null;
  return mapUser(res.rows[0]);
}

export async function createUser(data: {
  email: string;
  passwordHash?: string;
  name: string;
  avatarUrl?: string;
  provider: string;
  providerId?: string;
}): Promise<User> {
  const res = await pool.query(
    `INSERT INTO users (email, password_hash, name, avatar_url, provider, provider_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, name, avatar_url, provider, provider_id, created_at, updated_at`,
    [
      data.email,
      data.passwordHash ?? null,
      data.name,
      data.avatarUrl ?? null,
      data.provider,
      data.providerId ?? null,
    ]
  );
  return mapUser(res.rows[0]);
}

export async function getUserPasswordHash(
  userId: string
): Promise<string | null> {
  const res = await pool.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [userId]
  );
  return res.rows[0]?.password_hash ?? null;
}

export async function getPasswordHashByEmail(
  email: string
): Promise<{ id: string; hash: string } | null> {
  const res = await pool.query(
    `SELECT id, password_hash FROM users WHERE email = $1 AND provider = 'local'`,
    [email]
  );
  if (!res.rows[0]) return null;
  return { id: res.rows[0].id, hash: res.rows[0].password_hash };
}

// ─── Location Queries ──────────────────────────────────────────────────────

export async function insertLocationEvent(data: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  eventId: string;
  recordedAt: Date;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO location_history (user_id, latitude, longitude, accuracy, event_id, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        data.userId,
        data.latitude,
        data.longitude,
        data.accuracy ?? null,
        data.eventId,
        data.recordedAt,
      ]
    );
  } catch (err) {
    console.error("[DB] Failed to insert location event:", err);
  }
}

export async function getUserLocationHistory(
  userId: string,
  limit = 100
): Promise<Array<{ lat: number; lng: number; ts: number }>> {
  const res = await pool.query(
    `SELECT latitude, longitude, recorded_at
     FROM location_history
     WHERE user_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return res.rows.map((r) => ({
    lat: r.latitude,
    lng: r.longitude,
    ts: new Date(r.recorded_at).getTime(),
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    avatarUrl: row.avatar_url as string | undefined,
    provider: row.provider as "local" | "google",
    providerId: row.provider_id as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export { pool };
