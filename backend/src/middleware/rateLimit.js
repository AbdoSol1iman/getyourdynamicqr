import rateLimit from "express-rate-limit";

// Rate limiting: limits how many requests one client/IP can make inside a time
// window. Exceeding the limit returns HTTP 429 ("Too Many Requests").
// Limits are configurable via env vars; defaults suit local development.

function buildLimiter({ windowMinutes, max, message }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: true, // send standard RateLimit-* response headers
    legacyHeaders: false, // skip deprecated X-RateLimit-* headers
    handler: (req, res) => {
      res.status(429).json({ success: false, message });
    },
  });
}

// Applied to every /api request: blunt limit against bots hammering the API.
export const apiLimiter = buildLimiter({
  windowMinutes: 15,
  max: Number(process.env.RATE_LIMIT_API_MAX || 300),
  message: "Too many API requests. Please try again later.",
});

// Applied to login/register: stops brute-force password guessing attempts.
export const authLimiter = buildLimiter({
  windowMinutes: 15,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 5),
  message: "Too many attempts. Please try again in 15 minutes.",
});

// Applied to /q/:shortCode: generous because many people can scan a printed
// QR at once. Still protects the redirect engine from being flooded.
export const redirectLimiter = buildLimiter({
  windowMinutes: 1,
  max: Number(process.env.RATE_LIMIT_REDIRECT_MAX || 120),
  message: "Too many redirect requests from this address. Please try again soon.",
});