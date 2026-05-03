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

export function connectSocket(): Socket {
  const token = getToken();
  if (!token) throw new Error("No auth token");

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
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

export function sendLocation(
  latitude: number,
  longitude: number,
  accuracy?: number
): void {
  socket?.emit("location:send", { latitude, longitude, accuracy });
}

export function stopSharing(): void {
  socket?.emit("location:stop");
}

export function onUsersSnapshot(handler: SnapshotHandler): () => void {
  socket?.on("users:snapshot", handler);
  return () => socket?.off("users:snapshot", handler);
}

export function onLocationUpdate(handler: UpdateHandler): () => void {
  socket?.on("location:update", handler);
  return () => socket?.off("location:update", handler);
}

export function onUserLeft(handler: UserLeftHandler): () => void {
  socket?.on("user:left", handler);
  return () => socket?.off("user:left", handler);
}

export function onConnect(handler: ConnectHandler): () => void {
  socket?.on("connect", handler);
  return () => socket?.off("connect", handler);
}

export function onDisconnect(handler: DisconnectHandler): () => void {
  socket?.on("disconnect", handler);
  return () => socket?.off("disconnect", handler);
}

export function onSocketError(handler: ErrorHandler): () => void {
  socket?.on("error", handler);
  return () => socket?.off("error", handler);
}
