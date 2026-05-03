import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getUserLocationHistory } from "../services/db";

const router = Router();

// Get current user's location history
router.get("/history", requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const history = await getUserLocationHistory(req.user!.id, limit);
  res.json({ history });
});

export { router as locationRouter };
