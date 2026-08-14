import QRCode from "qrcode";
import { prisma } from "../prisma.js";
import { generateShortCode } from "../utils/shortCode.js";
import { parseUserAgent } from "../utils/userAgent.js";
import { getPlan } from "../config/plans.js";
import { getUserPlanType } from "./billing.service.js";
import { checkQrHealth } from "./qr.health.js";

// Public base URL used to build QR redirect links. Priority order:
//   1. BASE_URL env var (explicit override, e.g. a custom domain / reverse proxy).
//   2. WEBSITE_HOSTNAME (set automatically by Azure App Service) -> https://<host>.
//   3. Localhost, dev only.
// In production, if neither BASE_URL nor WEBSITE_HOSTNAME exists we fail fast
// rather than silently emitting localhost links in printed QR codes.
function resolveBaseUrl() {
  const explicit = (process.env.BASE_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const host = (process.env.WEBSITE_HOSTNAME || "").trim();
  if (host) return `https://${host}`;

  return "http://localhost:3000";
}

// Enforced once at startup so a misconfigured production box never serves
// localhost redirect links.
if (process.env.NODE_ENV === "production" && !process.env.BASE_URL && !process.env.WEBSITE_HOSTNAME) {
  throw new Error(
    "BASE_URL is not set. Configure a production BASE_URL (or rely on the Azure WEBSITE_HOSTNAME) or QR redirect links will point at localhost."
  );
}

// Read lazily so tests (and runtime config changes) can point it at the actual
// ephemeral server port.
export function getBaseUrl() {
  return resolveBaseUrl();
}

// Hostname of our own server; used to tell "normal" scans from custom-domain
// scans in the redirect controller.
export function getBaseHost() {
  return new URL(getBaseUrl()).hostname;
}

// Builds the public link a QR encodes. Custom domain QRs use the domain, all
// others use our default host.
function redirectUrlFor(qr) {
  const base = qr.domain ? `https://${qr.domain.domain}` : getBaseUrl();
  return `${base}/q/${qr.shortCode}`;
}

// A QR may optionally print on one of the user's verified custom domains.
async function findVerifiedDomain(userId, domainId) {
  const domain = await prisma.customDomain.findFirst({
    where: { id: domainId, userId },
  });
  if (!domain) {
    const err = new Error("Custom domain not found");
    err.status = 400;
    throw err;
  }
  if (!domain.isVerified) {
    const err = new Error("Custom domain is not verified yet");
    err.status = 400;
    throw err;
  }
  return domain;
}

// The QR image is a base64 PNG data URL encoding OUR redirect URL (never the
// destination). Returns null if generation fails so callers can surface it.
export async function qrImageFor(redirectUrl) {
  try {
    const dataUrl = await QRCode.toDataURL(redirectUrl);
    return typeof dataUrl === "string" && dataUrl.startsWith("data:image/png;base64,")
      ? dataUrl
      : null;
  } catch {
    return null;
  }
}

function validateDestinationUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function createUniqueShortCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateShortCode();
    const existing = await prisma.qRCode.findUnique({ where: { shortCode: candidate } });
    if (!existing) return candidate;
  }
  const err = new Error("Could not generate a unique short code");
  err.status = 500;
  throw err;
}

export async function createQr({ userId, title, destinationUrl, domainId }) {
  if (typeof title !== "string" || title.trim().length === 0 || title.length > 100) {
    const err = new Error("Title must be between 1 and 100 characters");
    err.status = 400;
    throw err;
  }

  if (!validateDestinationUrl(destinationUrl)) {
    const err = new Error("destinationUrl must be a valid http(s) URL");
    err.status = 400;
    throw err;
  }

  let domain = null;
  if (domainId) {
    domain = await findVerifiedDomain(userId, domainId);
  }

  // Plan gating: each plan allows a maximum number of (non-deleted) QR codes.
  const [planType, activeCount] = await Promise.all([
    getUserPlanType(userId),
    prisma.qRCode.count({ where: { userId, deletedAt: null } }),
  ]);
  const plan = getPlan(planType);
  if (activeCount >= plan.maxQrs) {
    const err = new Error(
      `You've reached the ${plan.label} plan's limit of ${plan.maxQrs} QR codes. Upgrade to create more.`
    );
    err.status = 403;
    throw err;
  }

  const shortCode = await createUniqueShortCode();

  const qr = await prisma.qRCode.create({
    data: {
      userId,
      title,
      shortCode,
      destinationUrl,
      domainId: domain ? domain.id : null,
    },
    include: { domain: true },
  });

  // The QR image encodes OUR redirect URL (on the default or custom host),
  // never the destination (spec §32).
  const redirectUrl = redirectUrlFor(qr);
  const qrImage = await qrImageFor(redirectUrl);

  // Verify the freshly created QR before it's considered ready: the redirect
  // URL must be production-safe, the image must exist, the redirect endpoint
  // must answer, and it must resolve to the requested destination.
  const health = await checkQrHealth({ redirectUrl, qrImage, destinationUrl });

  return {
    id: qr.id,
    title: qr.title,
    shortCode: qr.shortCode,
    destinationUrl: qr.destinationUrl,
    redirectUrl,
    qrType: qr.qrType,
    isActive: qr.isActive,
    createdAt: qr.createdAt,
    domain: qr.domain,
    qrImage,
    health,
  };
}

export async function findForRedirect(shortCode) {
  const qr = await prisma.qRCode.findUnique({ where: { shortCode } });
  if (!qr || qr.deletedAt !== null || !qr.isActive) {
    return null;
  }
  return qr;
}

// Custom-domain lookup: resolve the host to its owner, then only that owner's
// active QR codes are considered. Unknown/unverified hosts return null.
export async function findForRedirectOnDomain(host, shortCode) {
  const domain = await prisma.customDomain.findUnique({
    where: { domain: host },
  });
  if (!domain || !domain.isVerified) {
    return null;
  }
  const qr = await prisma.qRCode.findFirst({
    where: {
      shortCode,
      userId: domain.userId,
      deletedAt: null,
      isActive: true,
    },
  });
  return qr;
}

export async function recordScan({ qrCodeId, ipAddress, userAgent }) {
  const { deviceType, os, browser } = parseUserAgent(userAgent);
  return prisma.scanEvent.create({
    data: { qrCodeId, ipAddress, userAgent, deviceType, os, browser },
  });
}

async function findOwnedQr(userId, id) {
  const qr = await prisma.qRCode.findFirst({
    where: { id, userId, deletedAt: null },
    include: { domain: true },
  });
  if (!qr) {
    const err = new Error("QR code not found");
    err.status = 404;
    throw err;
  }
  return qr;
}

export async function listQrs(userId) {
  const qrs = await prisma.qRCode.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scanEvents: true } }, domain: true },
  });
  const mapped = qrs.map((qr) => {
    const redirectUrl = redirectUrlFor(qr);
    return {
      ...qr,
      scanCount: qr._count.scanEvents,
      redirectUrl,
      _count: undefined,
    };
  });
  // Generate a QR image for every card so the dashboard never has to render a
  // blank tile. Best-effort: a null image surfaces as a placeholder client-side.
  const images = await Promise.all(mapped.map((qr) => qrImageFor(qr.redirectUrl)));
  return mapped.map((qr, i) => ({ ...qr, qrImage: images[i] }));
}

export async function getQr(userId, id) {
  const qr = await findOwnedQr(userId, id);
  const redirectUrl = redirectUrlFor(qr);
  return { ...qr, redirectUrl, qrImage: await qrImageFor(redirectUrl) };
}

// Re-runs the full health/validation check on demand (dashboard "Verify").
export async function verifyQrHealth(userId, id) {
  const qr = await findOwnedQr(userId, id);
  const redirectUrl = redirectUrlFor(qr);
  const qrImage = await qrImageFor(redirectUrl);
  const health = await checkQrHealth({
    redirectUrl,
    qrImage,
    destinationUrl: qr.destinationUrl,
  });
  return { redirectUrl, qrImage, health };
}

export async function updateQr(userId, id, updates) {
  await findOwnedQr(userId, id);

  const data = {};
  if (updates.title !== undefined) {
    if (typeof updates.title !== "string" || updates.title.trim().length === 0 || updates.title.length > 100) {
      const err = new Error("Title must be between 1 and 100 characters");
      err.status = 400;
      throw err;
    }
    data.title = updates.title;
  }

  if (updates.destinationUrl !== undefined) {
    if (!validateDestinationUrl(updates.destinationUrl)) {
      const err = new Error("destinationUrl must be a valid http(s) URL");
      err.status = 400;
      throw err;
    }
    data.destinationUrl = updates.destinationUrl;
  }

  if (updates.isActive !== undefined) {
    if (typeof updates.isActive !== "boolean") {
      const err = new Error("isActive must be a boolean");
      err.status = 400;
      throw err;
    }
    data.isActive = updates.isActive;
  }

  if (updates.designConfig !== undefined) {
    data.designConfig = updates.designConfig;
  }

  if (updates.domainId !== undefined) {
    if (updates.domainId === null) {
      data.domainId = null;
    } else {
      const domain = await findVerifiedDomain(userId, updates.domainId);
      data.domainId = domain.id;
    }
  }

  if (Object.keys(data).length === 0) {
    const err = new Error("No valid fields to update");
    err.status = 400;
    throw err;
  }

  await prisma.qRCode.update({
    where: { id },
    data,
  });

  // Re-fetch so the response includes the (possibly changed) domain relation.
  const qr = await findOwnedQr(userId, id);
  const redirectUrl = redirectUrlFor(qr);
  return { ...qr, redirectUrl, qrImage: await qrImageFor(redirectUrl) };
}

export async function softDeleteQr(userId, id) {
  await findOwnedQr(userId, id);
  await prisma.qRCode.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function getQrAnalytics(userId, id) {
  await findOwnedQr(userId, id);

  const DAYS = 14;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const startOfHistory = new Date(startOfToday);
  startOfHistory.setUTCDate(startOfHistory.getUTCDate() - (DAYS - 1));

  // groupBy gives us one aggregate per distinct value of a column.
  async function breakdownBy(field) {
    const rows = await prisma.scanEvent.groupBy({
      by: [field],
      where: { qrCodeId: id },
      _count: true,
    });
    return rows
      .filter((row) => row[field] !== null) // old scans have no value yet
      .map((row) => ({ name: row[field], count: row._count }))
      .sort((a, b) => b.count - a.count);
  }

  const [
    totalScans,
    scansToday,
    scansThisWeek,
    recentScans,
    historyRows,
    devices,
    operatingSystems,
    browsers,
  ] = await Promise.all([
    prisma.scanEvent.count({ where: { qrCodeId: id } }),
    prisma.scanEvent.count({ where: { qrCodeId: id, scannedAt: { gte: startOfToday } } }),
    prisma.scanEvent.count({ where: { qrCodeId: id, scannedAt: { gte: startOfWeek } } }),
    prisma.scanEvent.findMany({
      where: { qrCodeId: id },
      orderBy: { scannedAt: "desc" },
      take: 10,
    }),
    // For per-day totals we fetch only the timestamps of the last 14 days and
    // count them in JS (per spec §30.7, avoid raw SQL unless Prisma can't do
    // the job reasonably).
    prisma.scanEvent.findMany({
      where: { qrCodeId: id, scannedAt: { gte: startOfHistory } },
      select: { scannedAt: true },
    }),
    breakdownBy("deviceType"),
    breakdownBy("os"),
    breakdownBy("browser"),
  ]);

  const countByDay = new Map();
  for (const row of historyRows) {
    const day = row.scannedAt.toISOString().slice(0, 10);
    countByDay.set(day, (countByDay.get(day) || 0) + 1);
  }

  const scansByDate = [];
  for (let i = 0; i < DAYS; i++) {
    const day = new Date(startOfHistory);
    day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    scansByDate.push({ date: key, count: countByDay.get(key) || 0 });
  }

  return {
    totalScans,
    scansToday,
    scansThisWeek,
    scansByDate,
    devices,
    operatingSystems,
    browsers,
    recentScans,
  };
}
