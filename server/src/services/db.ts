import { Pool } from "pg";
import { config } from "../config/env";

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

// ─── Location Queries ────────────────────────────────────────────────────────
// NOTE: user_id stores the Clerk userId string (user_xxx) directly.
// The users table has been removed — Clerk is the source of truth for user data.

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
      ],
    );
  } catch (err) {
    console.error("[DB] Failed to insert location event:", err);
  }
}

export async function getUserLocationHistory(
  userId: string,
  limit = 100,
): Promise<Array<{ lat: number; lng: number; ts: number }>> {
  const res = await pool.query(
    `SELECT latitude, longitude, recorded_at
     FROM location_history
     WHERE user_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((r) => ({
    lat: r.latitude,
    lng: r.longitude,
    ts: new Date(r.recorded_at).getTime(),
  }));
}

export { pool };
