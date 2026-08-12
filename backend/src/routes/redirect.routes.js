import { Router } from "express";
import { redirect } from "../controllers/redirect.controller.js";
import { redirectLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.use(redirectLimiter);

router.get("/:shortCode", redirect);

export default router;
