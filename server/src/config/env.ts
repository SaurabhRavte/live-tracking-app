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

export const config = {
  port: parseInt(optional("PORT", "4000")),
  nodeEnv: optional("NODE_ENV", "development"),
  isDev: optional("NODE_ENV", "development") === "development",

  db: {
    url: optional(
      "DATABASE_URL",
      "postgresql://tracker:tracker_secret@localhost:5432/tracker_db"
    ),
  },

  kafka: {
    brokers: optional("KAFKA_BROKERS", "localhost:29092").split(","),
    locationTopic: "location-events",
    dbConsumerGroup: "location-db-writer",
    socketConsumerGroup: "location-socket-broadcaster",
  },

  jwt: {
    secret: optional("JWT_SECRET", "dev_jwt_secret_change_in_prod"),
    expiresIn: "7d",
  },

  session: {
    secret: optional("SESSION_SECRET", "dev_session_secret"),
  },

  google: {
    clientId: optional("GOOGLE_CLIENT_ID", ""),
    clientSecret: optional("GOOGLE_CLIENT_SECRET", ""),
    callbackUrl: optional(
      "GOOGLE_CALLBACK_URL",
      "http://localhost:4000/api/auth/google/callback"
    ),
  },

  clientUrl: optional("CLIENT_URL", "http://localhost:5173"),

  // Stale user threshold: remove from map after this many ms without update
  staleUserMs: 30_000,
};
