import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { findUserById } from "../services/db";
import { JwtPayload, User } from "../types";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(user: User): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    return null;
  }
}
