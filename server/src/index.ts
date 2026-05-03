import express from "express";
import { createServer } from "http";
import cors from "cors";
import { config } from "./config/env";
import { connectDb } from "./services/db";
import { connectProducer, disconnectProducer } from "./kafka/producer";
import {
  startSocketConsumer,
  stopSocketConsumer,
} from "./kafka/socketConsumer";
import { startDbConsumer, stopDbConsumer } from "./kafka/dbConsumer";
import { initSocket, shutdownSocket } from "./socket/server";
import { authRouter } from "./routes/auth";
import { locationRouter } from "./routes/location";

async function bootstrap() {
  // ─── Express app ────────────────────────────────────────────────────────
  const app = express();

  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    }),
  );
  app.use(express.json());

  // ─── Routes ─────────────────────────────────────────────────────────────
  app.use("/api/auth", authRouter);
  app.use("/api/location", locationRouter);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  // ─── HTTP + Socket.IO ────────────────────────────────────────────────────
  const httpServer = createServer(app);
  initSocket(httpServer);

  // ─── Connect services ────────────────────────────────────────────────────
  try {
    await connectDb();
  } catch (err) {
    console.error("[Bootstrap] DB connection failed:", err);
    process.exit(1);
  }

  try {
    await connectProducer();
    await startSocketConsumer();
    await startDbConsumer();
  } catch (err) {
    console.error("[Bootstrap] Kafka connection failed:", err);
    console.warn(
      "[Bootstrap] Continuing without Kafka — location events will broadcast directly",
    );
  }

  // ─── Start listening ─────────────────────────────────────────────────────
  httpServer.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.log(`\n[Server] Received ${signal}, shutting down...`);
    shutdownSocket();
    await disconnectProducer();
    await stopSocketConsumer();
    await stopDbConsumer();
    httpServer.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[Bootstrap] Fatal error:", err);
  process.exit(1);
});
