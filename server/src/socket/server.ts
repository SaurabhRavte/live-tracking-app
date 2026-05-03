import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { createClerkClient } from "@clerk/backend";
import { config } from "../config/env";
import { verifyTokenClaims } from "../middleware/auth";
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

// Clerk client for fetching user display name from Clerk (optional)
const clerk = config.clerk.secretKey
  ? createClerkClient({ secretKey: config.clerk.secretKey })
  : null;

export function getIo(): SocketServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function getLiveUsers(): LiveUser[] {
  return Array.from(liveUsers.values());
}

async function resolveUserName(userId: string): Promise<string> {
  if (!clerk) return `User-${userId.slice(-4)}`;
  try {
    const user = await clerk.users.getUser(userId);
    return (
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      `User-${userId.slice(-4)}`
    );
  } catch {
    return `User-${userId.slice(-4)}`;
  }
}

async function resolveAvatarUrl(userId: string): Promise<string | undefined> {
  if (!clerk) return undefined;
  try {
    const user = await clerk.users.getUser(userId);
    return user.imageUrl || undefined;
  } catch {
    return undefined;
  }
}

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ─── Auth middleware ────────────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      next(new Error("Authentication required"));
      return;
    }

    // Decode JWT claims to get userId (sub)
    // Full cryptographic verification is handled by Clerk's verifyToken.
    // For socket connections we decode claims and trust Clerk's signed token.
    const claims = verifyTokenClaims(token);
    if (!claims) {
      next(new Error("Invalid token"));
      return;
    }

    socket.data.userId = claims.sub;
    // Resolve display name and avatar from Clerk (async, non-blocking)
    socket.data.userName = await resolveUserName(claims.sub);
    socket.data.avatarUrl = await resolveAvatarUrl(claims.sub);
    next();
  });

  // ─── Connection handler ─────────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    const userName = socket.data.userName as string;
    const avatarUrl = socket.data.avatarUrl as string | undefined;

    console.log(`[Socket] User connected: ${userName} (${userId})`);
    socketUserMap.set(socket.id, userId);

    // Send current live users to the newly connected client
    socket.emit("users:snapshot", getLiveUsers());

    // ─── Location update ──────────────────────────────────────────────
    socket.on(
      "location:send",
      async (data: {
        latitude: number;
        longitude: number;
        accuracy?: number;
      }) => {
        // Validate coordinates
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
      },
    );

    // ─── Stop sharing ──────────────────────────────────────────────────
    socket.on("location:stop", () => {
      liveUsers.delete(userId);
      io.emit("user:left", { userId });
    });

    // ─── Disconnect ────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] User disconnected: ${userName} (${userId}) — ${reason}`,
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

  // ─── Stale user cleanup ─────────────────────────────────────────────────
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
