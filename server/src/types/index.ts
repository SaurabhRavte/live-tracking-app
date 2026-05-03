export interface User {
  id: string; // Clerk userId (user_xxx)
  email: string;
  name: string;
  avatarUrl?: string;
  provider: "clerk";
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

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      clerkUserId?: string;
    }
  }
}
