import { Router } from "express";
import { plan, pay, confirm } from "../controllers/billing.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/plan", plan);
router.post("/pay", pay);
router.post("/confirm", confirm);

export default router;