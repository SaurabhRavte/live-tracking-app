import { User } from "../types";

const TOKEN_KEY = "tracker_token";

// ─── Token helpers ─────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Simple event emitter for auth state changes ───────────────────────────

type Listener = (user: User | null) => void;
const listeners: Set<Listener> = new Set();

let currentUser: User | null = null;

export function getUser(): User | null {
  return currentUser;
}

export function setUser(user: User | null): void {
  currentUser = user;
  listeners.forEach((fn) => fn(user));
}

export function onAuthChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ─── API helpers ───────────────────────────────────────────────────────────

const API_URL = (import.meta.env.VITE_API_URL as string) || "";

export async function apiRegister(
  email: string,
  password: string,
  name: string
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error);
  }
  return res.json() as Promise<{ token: string; user: User }>;
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error);
  }
  return res.json() as Promise<{ token: string; user: User }>;
}

export async function apiGetMe(token: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Session expired");
  const data = (await res.json()) as { user: User };
  return data.user;
}

export function getGoogleLoginUrl(): string {
  return `${API_URL}/api/auth/google`;
}

export async function initAuth(): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    const user = await apiGetMe(token);
    setUser(user);
  } catch {
    clearToken();
    setUser(null);
  }
}
