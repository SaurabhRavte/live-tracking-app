import Clerk from "@clerk/clerk-js";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY — add it to client/.env");
}

// Single Clerk instance shared across the app
export const clerk = new Clerk(PUBLISHABLE_KEY);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

// ─── Simple event emitter for auth state changes ──────────────────────────────

type Listener = (user: AppUser | null) => void;
const listeners: Set<Listener> = new Set();
let currentUser: AppUser | null = null;

export function getUser(): AppUser | null {
  return currentUser;
}

export function setUser(user: AppUser | null): void {
  currentUser = user;
  listeners.forEach((fn) => fn(user));
}

export function onAuthChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ─── Init ────────────────────────────────────────────────────────────────────

export async function initAuth(): Promise<void> {
  await clerk.load();

  if (clerk.user) {
    setUser(mapClerkUser());
  }

  // Keep local state in sync when Clerk session changes
  clerk.addListener(({ user }) => {
    if (user) {
      setUser(mapClerkUser());
    } else {
      setUser(null);
    }
  });
}

function mapClerkUser(): AppUser | null {
  const u = clerk.user;
  if (!u) return null;
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? "",
    name:
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.username ||
      "User",
    avatarUrl: u.imageUrl || undefined,
  };
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Returns the current Clerk session JWT.
 * This is async because Clerk refreshes tokens automatically.
 */
export async function getToken(): Promise<string | null> {
  if (!clerk.session) return null;
  try {
    return await clerk.session.getToken();
  } catch {
    return null;
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await clerk.signOut();
  setUser(null);
}
