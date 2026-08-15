import { Router } from "express";
import {
  plan,
  pay,
  submit,
  resubmit,
  payments,
  approve,
  decline,
} from "../controllers/billing.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/plan", authenticate, plan);
router.post("/pay", authenticate, pay);
router.post("/submit", authenticate, submit);
router.post("/resubmit", authenticate, resubmit);

// Owner-only payment review.
router.get("/payments", requireAdmin, payments);
router.post("/payments/:paymentId/approve", requireAdmin, approve);
router.post("/payments/:paymentId/decline", requireAdmin, decline);

export default router;