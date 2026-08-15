import { prisma } from "../prisma.js";
import { PLANS, PLAN_ORDER } from "../config/plans.js";

const VALID_ROLES = ["USER", "ADMIN"];

function toPublicUser(u) {
  return {
    id: u.id,
    email: u.email,
    planType: u.planType,
    role: u.role,
    isActive: u.isActive,
    qrCount: u._count?.qrCodes ?? 0,
    createdAt: u.createdAt,
  };
}

// Owner-only: list every user for the management dashboard.
export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { qrCodes: true } } },
  });
  return users.map(toPublicUser);
}

// Owner-only: change a user's plan, role, or active flag.
// We never allow removing the last admin or disabling your own account
// (that would lock the owner out of the dashboard).
export async function updateUser(actorUserId, targetUserId, changes) {
  const { planType, role, isActive } = changes ?? {};

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const data = {};

  if (planType !== undefined) {
    const planKeys = new Set([...PLAN_ORDER, "ENTERPRISE"]);
    if (!planKeys.has(planType)) {
      const err = new Error("Unknown plan");
      err.status = 400;
      throw err;
    }
    data.planType = planType;
  }

  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      const err = new Error("Role must be USER or ADMIN");
      err.status = 400;
      throw err;
    }
    // Refuse to demote the last remaining admin.
    if (target.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        const err = new Error("Cannot remove the last admin");
        err.status = 400;
        throw err;
      }
    }
    data.role = role;
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      const err = new Error("isActive must be a boolean");
      err.status = 400;
      throw err;
    }
    if (targetUserId === actorUserId && isActive === false) {
      const err = new Error("You cannot disable your own account");
      err.status = 400;
      throw err;
    }
    data.isActive = isActive;
  }

  if (Object.keys(data).length === 0) {
    const err = new Error("Nothing to update");
    err.status = 400;
    throw err;
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data,
    include: { _count: { select: { qrCodes: true } } },
  });

  return toPublicUser(updated);
}