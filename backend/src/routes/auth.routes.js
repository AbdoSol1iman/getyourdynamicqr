import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.use(authLimiter); // brute-force protection on register/login

router.post("/register", register);
router.post("/login", login);

export default router;
