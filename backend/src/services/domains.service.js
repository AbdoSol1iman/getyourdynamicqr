import { prisma } from "../prisma.js";
import { getPlan } from "../config/plans.js";
import { getUserPlanType } from "./billing.service.js";

// Custom domains: let a user attach their own hostname to their QR links.
// A domain must be unique globally and verified before we serve redirects
// on it (MVP verifies automatically; a real product would check DNS TXT).

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

const AUTO_VERIFY = process.env.CUSTOM_DOMAIN_AUTO_VERIFY !== "false";

function validateDomain(domain) {
  if (typeof domain !== "string" || !DOMAIN_REGEX.test(domain)) {
    const err = new Error("Enter a valid domain like qr.myrestaurant.com");
    err.status = 400;
    throw err;
  }
}

export async function listDomains(userId) {
  return prisma.customDomain.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDomain(userId, domain) {
  // Custom domains are a paid-plan feature.
  const planType = await getUserPlanType(userId);
  if (!getPlan(planType).customDomains) {
    const err = new Error("Custom domains require the Pro plan or higher");
    err.status = 403;
    throw err;
  }

  const normalized = String(domain).trim().toLowerCase();
  validateDomain(normalized);

  try {
    return await prisma.customDomain.create({
      data: {
        userId,
        domain: normalized,
        isVerified: AUTO_VERIFY,
      },
    });
  } catch (err) {
    // P2002 = unique constraint violated (domain already taken).
    if (err.code === "P2002") {
      const conflict = new Error("That domain is already in use");
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function findOwnedDomain(userId, id) {
  const domain = await prisma.customDomain.findFirst({
    where: { id, userId },
  });
  if (!domain) {
    const err = new Error("Custom domain not found");
    err.status = 404;
    throw err;
  }
  return domain;
}

export async function deleteDomain(userId, id) {
  await findOwnedDomain(userId, id);
  // Deleting a domain clears domainId on any of the user's QRs (SetNull),
  // so their printable links fall back to the default host.
  await prisma.customDomain.delete({ where: { id } });
}