import { Router, Request, Response } from "express";
import { requireAuth, getClerkUser } from "../middleware/auth";

const router: Router = Router();

// GET /api/auth/me
// Returns the current user's profile fetched from Clerk.
// The frontend calls this after loading the Clerk session to hydrate the local user state.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.clerkUserId!;

  const clerkUser = await getClerkUser(userId);

  if (!clerkUser) {
    // Clerk key not configured (dev mode) — return a minimal stub
    res.json({
      user: {
        id: userId,
        email: "dev@localhost",
        name: "Dev User",
        avatarUrl: null,
        provider: "clerk",
      },
    });
    return;
  }

  res.json({
    user: {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        "User",
      avatarUrl: clerkUser.imageUrl ?? null,
      provider: "clerk",
    },
  });
});

// POST /api/auth/logout — no-op with Clerk (session managed client-side)
router.post("/logout", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

export { router as authRouter };
