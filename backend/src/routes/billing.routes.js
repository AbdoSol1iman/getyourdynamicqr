import { Router } from "express";
import { plan, instapay, confirm } from "../controllers/billing.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/plan", plan);
router.post("/instapay", instapay);
router.post("/confirm", confirm);

export default router;