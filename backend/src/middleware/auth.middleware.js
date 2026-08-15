import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../prisma.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// Owner-only gate: the token's user must have role "ADMIN" (checked against the
// DB at request time). Used for payment review (approve/list), so a random
// customer can't approve their own upgrade.
export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    req.user = { userId: payload.userId };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}