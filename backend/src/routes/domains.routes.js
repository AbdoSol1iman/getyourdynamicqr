import { Router } from "express";
import { list, create, remove } from "../controllers/domains.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", create);
router.get("/", list);
router.delete("/:id", remove);

export default router;