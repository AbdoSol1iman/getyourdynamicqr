import { Router } from "express";
import {
  create,
  list,
  getOne,
  update,
  remove,
  analytics,
} from "../controllers/qr.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", authenticate, create);
router.get("/", authenticate, list);
router.get("/:id/analytics", authenticate, analytics);
router.get("/:id", authenticate, getOne);
router.patch("/:id", authenticate, update);
router.delete("/:id", authenticate, remove);

export default router;
