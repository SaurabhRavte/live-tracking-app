import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import {
  findUserByEmail,
  findUserByProviderId,
  createUser,
  getPasswordHashByEmail,
  findUserById,
} from "../services/db";
import { signToken, requireAuth } from "../middleware/auth";
import { config } from "../config/env";
import { User } from "../types";

const router = Router();

// ─── Passport Setup ────────────────────────────────────────────────────────

passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const row = await getPasswordHashByEmail(email);
        if (!row) return done(null, false, { message: "Invalid credentials" });

        const valid = await bcrypt.compare(password, row.hash);
        if (!valid) return done(null, false, { message: "Invalid credentials" });

        const user = await findUserById(row.id);
        return done(null, user ?? false);
      } catch (err) {
        return done(err);
      }
    }
  )
);

if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: unknown, user?: User | false) => void
      ) => {
        try {
          const existingByProvider = await findUserByProviderId(
            "google",
            profile.id
          );
          if (existingByProvider) return done(null, existingByProvider);

          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email from Google"));

          const existingByEmail = await findUserByEmail(email);
          if (existingByEmail) return done(null, existingByEmail);

          const user = await createUser({
            email,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
            provider: "google",
            providerId: profile.id,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Register
router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    email,
    passwordHash,
    name,
    provider: "local",
  });

  const token = signToken(user);
  res.status(201).json({ token, user: sanitize(user) });
});

// Login
router.post("/login", (req: Request, res: Response, next) => {
  passport.authenticate(
    "local",
    { session: false },
    (
      err: Error | null,
      user: User | false,
      info: { message: string } | undefined
    ) => {
      if (err) return next(err);
      if (!user) {
        res.status(401).json({ error: info?.message ?? "Invalid credentials" });
        return;
      }
      const token = signToken(user);
      res.json({ token, user: sanitize(user) });
    }
  )(req, res, next);
});

// Google OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  (req: Request, res: Response, next) => {
    passport.authenticate(
      "google",
      { session: false },
      (err: Error | null, user: User | false) => {
        if (err || !user) {
          res.redirect(
            `${config.clientUrl}/login?error=google_auth_failed`
          );
          return;
        }
        const token = signToken(user);
        // Redirect to frontend with token in query (frontend stores in memory/localStorage)
        res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
      }
    )(req, res, next);
  }
);

// Get current user
router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: sanitize(req.user!) });
});

// Logout (client-side token deletion, but endpoint for completeness)
router.post("/logout", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

function sanitize(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
  };
}

export { router as authRouter, passport };
