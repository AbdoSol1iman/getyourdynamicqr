import express from "express";
import cors from "cors";
import { prisma } from "./prisma.js";
import authRoutes from "./routes/auth.routes.js";
import qrRoutes from "./routes/qr.routes.js";
import domainRoutes from "./routes/domains.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import redirectRoutes from "./routes/redirect.routes.js";
import { authenticate } from "./middleware/auth.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.js";

const app = express();

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return origin.endsWith('.vercel.app');
}

// Trust the first reverse proxy hop so req.ip reflects the real client IP.
// Required in production (Render/Vercel) for accurate rate limiting and
// scan-event IPs; harmless in local dev without a proxy.
app.set("trust proxy", 1);

// CORS: in production, restrict to the origins listed in CORS_ORIGINS
// (comma-separated). If unset (local dev), allow all origins (spec §20).
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Dynamic QR API is running" });
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    console.error("Health check database error:", err);
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/billing", billingRoutes);
app.use("/q", redirectRoutes);

// Protected route used to verify the auth middleware works end-to-end.
app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

// Central error handler: keeps API responses consistent and hides raw errors.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error("Server error:", err);
  }
  res.status(status).json({ success: false, message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;

export default app;

if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Dynamic QR API listening on http://localhost:${PORT}`);
  });
}