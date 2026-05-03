import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

const isDev = optional("NODE_ENV", "development") === "development";

export const config = {
  port: parseInt(optional("PORT", "4000")),
  nodeEnv: optional("NODE_ENV", "development"),
  isDev,

  db: {
    url: optional(
      "DATABASE_URL",
      "postgresql://tracker:tracker_secret@localhost:5432/tracker_db",
    ),
  },

  kafka: {
    brokers: optional("KAFKA_BROKERS", "localhost:29092").split(","),
    locationTopic: "location-events",
    dbConsumerGroup: "location-db-writer",
    socketConsumerGroup: "location-socket-broadcaster",
  },

  clerk: {
    // In production CLERK_SECRET_KEY is required; in dev it can be empty for local testing
    secretKey: isDev
      ? optional("CLERK_SECRET_KEY", "")
      : required("CLERK_SECRET_KEY"),
  },

  clientUrl: optional("CLIENT_URL", "http://localhost:5173"),

  // Stale user threshold: remove from map after this many ms without update
  staleUserMs: 30_000,
};
