export interface AppUser {
  id: string; // Clerk userId
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface LiveUser {
  userId: string;
  userName: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  lastSeen?: number;
}

export interface LocationUpdate {
  userId: string;
  userName: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface ApiError {
  error: string;
}
