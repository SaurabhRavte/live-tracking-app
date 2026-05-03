export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: "local" | "google";
  providerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationEvent {
  eventId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number; // Unix ms
}

export interface LiveUser {
  userId: string;
  userName: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  lastSeen: number; // Unix ms
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  name: string;
  avatarUrl?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
