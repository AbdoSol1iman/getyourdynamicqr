import { Router } from "express";
import {
  plan,
  pay,
  submit,
  payments,
  approve,
} from "../controllers/billing.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/plan", authenticate, plan);
router.post("/pay", authenticate, pay);
router.post("/submit", authenticate, submit);

// Owner-only payment review.
router.get("/payments", requireAdmin, payments);
router.post("/payments/:paymentId/approve", requireAdmin, approve);

export default router;