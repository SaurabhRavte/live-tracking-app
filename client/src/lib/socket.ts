import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";
import { LiveUser, LocationUpdate } from "../types";

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string) || "";

let socket: Socket | null = null;

type SnapshotHandler = (users: LiveUser[]) => void;
type UpdateHandler = (update: LocationUpdate) => void;
type UserLeftHandler = (data: { userId: string }) => void;
type ConnectHandler = () => void;
type DisconnectHandler = (reason: string) => void;
type ErrorHandler = (err: { message: string }) => void;

// Registered cleanup functions — stored so we can remove all listeners on disconnect
const cleanupFns: Array<() => void> = [];

export async function connectSocket(): Promise<Socket> {
  const token = await getToken();
  if (!token) throw new Error("No auth token — please sign in");

  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket(): void {
  // Remove all registered listeners before disconnecting
  cleanupFns.forEach((fn) => fn());
  cleanupFns.length = 0;
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

export function sendLocation(
  latitude: number,
  longitude: number,
  accuracy?: number,
): void {
  socket?.emit("location:send", { latitude, longitude, accuracy });
}

export function stopSharing(): void {
  socket?.emit("location:stop");
}

// ─── Event subscription helpers ───────────────────────────────────────────────
// Each helper returns an unsubscribe function.
// AppPage must call the returned function on unmount to prevent listener buildup.

export function onUsersSnapshot(handler: SnapshotHandler): () => void {
  socket?.on("users:snapshot", handler);
  const unsub = () => socket?.off("users:snapshot", handler);
  cleanupFns.push(unsub);
  return unsub;
}

export function onLocationUpdate(handler: UpdateHandler): () => void {
  socket?.on("location:update", handler);
  const unsub = () => socket?.off("location:update", handler);
  cleanupFns.push(unsub);
  return unsub;
}

export function onUserLeft(handler: UserLeftHandler): () => void {
  socket?.on("user:left", handler);
  const unsub = () => socket?.off("user:left", handler);
  cleanupFns.push(unsub);
  return unsub;
}

export function onConnect(handler: ConnectHandler): () => void {
  socket?.on("connect", handler);
  const unsub = () => socket?.off("connect", handler);
  cleanupFns.push(unsub);
  return unsub;
}

export function onDisconnect(handler: DisconnectHandler): () => void {
  socket?.on("disconnect", handler);
  const unsub = () => socket?.off("disconnect", handler);
  cleanupFns.push(unsub);
  return unsub;
}

export function onSocketError(handler: ErrorHandler): () => void {
  socket?.on("error", handler);
  const unsub = () => socket?.off("error", handler);
  cleanupFns.push(unsub);
  return unsub;
}
