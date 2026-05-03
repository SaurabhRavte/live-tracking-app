import { Request, Response, NextFunction } from "express";
import { createClerkClient } from "@clerk/backend";
import { config } from "../config/env";

// Initialize Clerk client (works fine with empty secretKey in dev — just won't verify real tokens)
const clerk = config.clerk.secretKey
  ? createClerkClient({ secretKey: config.clerk.secretKey })
  : null;

export interface ClerkUserPayload {
  sub: string; // Clerk userId (user_xxx)
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

// Extend Express Request with clerk user info
declare global {
  namespace Express {
    interface Request {
      clerkUserId?: string;
      clerkUser?: ClerkUserPayload;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!clerk) {
    // Dev mode with no Clerk key — skip verification and trust the token as a userId directly
    // This allows testing without a real Clerk account
    req.clerkUserId = token;
    next();
    return;
  }

  try {
    const payload = await clerk.verifyToken(token);
    req.clerkUserId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function getClerkUser(userId: string) {
  if (!clerk) return null;
  try {
    return await clerk.users.getUser(userId);
  } catch {
    return null;
  }
}

export function verifyTokenClaims(token: string): { sub: string } | null {
  // Lightweight decode (no verify) used by socket middleware for the claims only.
  // Full verify happens in requireAuth for HTTP routes.
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { sub?: string };
    if (!payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
