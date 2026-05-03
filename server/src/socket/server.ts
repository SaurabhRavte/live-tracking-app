import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { config } from "../config/env";
import { verifyToken } from "../middleware/auth";
import { publishLocationEvent } from "../kafka/producer";
import { LiveUser, LocationEvent } from "../types";
import { v4 as uuidv4 } from "uuid";

let io: SocketServer;

// In-memory store of currently active users
// userId → LiveUser
const liveUsers = new Map<string, LiveUser>();

// socketId → userId (for disconnect cleanup)
const socketUserMap = new Map<string, string>();

// Stale user cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

export function getIo(): SocketServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function getLiveUsers(): LiveUser[] {
  return Array.from(liveUsers.values());
}

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ─── Auth middleware ───────────────────────────────────────────────────
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      next(new Error("Authentication required"));
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      next(new Error("Invalid token"));
      return;
    }

    // Attach user info to socket data
    socket.data.userId = payload.sub;
    socket.data.userName = payload.name;
    socket.data.avatarUrl = payload.avatarUrl;
    next();
  });

  // ─── Connection handler ────────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    const userName = socket.data.userName as string;
    const avatarUrl = socket.data.avatarUrl as string | undefined;

    console.log(`[Socket] User connected: ${userName} (${userId})`);
    socketUserMap.set(socket.id, userId);

    // Send current live users to the newly connected client
    socket.emit("users:snapshot", getLiveUsers());

    // ─── Location update ─────────────────────────────────────────────
    socket.on(
      "location:send",
      async (data: {
        latitude: number;
        longitude: number;
        accuracy?: number;
      }) => {
        // Validate
        if (
          typeof data.latitude !== "number" ||
          typeof data.longitude !== "number" ||
          data.latitude < -90 ||
          data.latitude > 90 ||
          data.longitude < -180 ||
          data.longitude > 180
        ) {
          socket.emit("error", { message: "Invalid location data" });
          return;
        }

        const event: LocationEvent = {
          eventId: uuidv4(),
          userId,
          userName,
          avatarUrl,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          timestamp: Date.now(),
        };

        // Update in-memory live user store immediately
        liveUsers.set(userId, {
          userId,
          userName,
          avatarUrl,
          latitude: event.latitude,
          longitude: event.longitude,
          accuracy: event.accuracy,
          lastSeen: event.timestamp,
        });

        // Publish to Kafka → consumers handle broadcasting + DB write
        try {
          await publishLocationEvent(event);
        } catch (err) {
          console.error("[Socket] Failed to publish to Kafka:", err);
          // Fallback: broadcast directly so UI doesn't freeze
          io.emit("location:update", {
            userId: event.userId,
            userName: event.userName,
            avatarUrl: event.avatarUrl,
            latitude: event.latitude,
            longitude: event.longitude,
            accuracy: event.accuracy,
            timestamp: event.timestamp,
          });
        }
      }
    );

    // ─── Stop sharing ─────────────────────────────────────────────────
    socket.on("location:stop", () => {
      liveUsers.delete(userId);
      io.emit("user:left", { userId });
    });

    // ─── Disconnect ───────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] User disconnected: ${userName} (${userId}) — ${reason}`
      );
      socketUserMap.delete(socket.id);

      // Only remove from live map if no other sockets for same user
      const hasOtherSocket = [...socketUserMap.values()].includes(userId);
      if (!hasOtherSocket) {
        liveUsers.delete(userId);
        io.emit("user:left", { userId });
      }
    });
  });

  // ─── Stale user cleanup ────────────────────────────────────────────────
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, user] of liveUsers.entries()) {
      if (now - user.lastSeen > config.staleUserMs) {
        console.log(`[Socket] Removing stale user: ${user.userName}`);
        liveUsers.delete(userId);
        io.emit("user:left", { userId });
      }
    }
  }, 10_000);

  console.log("[Socket] Socket.IO server initialized");
  return io;
}

export function shutdownSocket(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
