import { Router } from "express";
import { users, updateUserStatus } from "../controllers/admin.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Owner-only admin dashboard (user + plan management).
router.get("/users", requireAdmin, users);
router.patch("/users/:id", requireAdmin, updateUserStatus);

export default router;