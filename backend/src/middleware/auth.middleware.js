import { verifyToken } from "../utils/jwt.js";

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
