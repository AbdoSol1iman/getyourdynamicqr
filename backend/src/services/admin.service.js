import { prisma } from "../prisma.js";
import { PLAN_ORDER } from "../config/plans.js";

const VALID_ROLES = new Set(["USER", "ADMIN"]);
const VALID_PLANS = new Set([...PLAN_ORDER, "ENTERPRISE"]);

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

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

async function requireNotLastAdmin(target, role) {
  if (target.role !== "ADMIN" || role === "ADMIN") return;
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount <= 1) {
    throw fail("Cannot remove the last admin", 400);
  }
}

function buildChanges(changes, actorUserId, targetUserId) {
  const { planType, role, isActive } = changes ?? {};
  const data = {};

  if (planType !== undefined) {
    if (!VALID_PLANS.has(planType)) throw fail("Unknown plan", 400);
    data.planType = planType;
  }

  if (role !== undefined) {
    if (!VALID_ROLES.has(role)) throw fail("Role must be USER or ADMIN", 400);
    data.role = role;
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") throw fail("isActive must be a boolean", 400);
    if (targetUserId === actorUserId && isActive === false) {
      throw fail("You cannot disable your own account", 400);
    }
    data.isActive = isActive;
  }

  if (Object.keys(data).length === 0) throw fail("Nothing to update", 400);
  return data;
}

// Owner-only: change a user's plan, role, or active flag.
// We never allow removing the last admin or disabling your own account
// (that would lock the owner out of the dashboard).
export async function updateUser(actorUserId, targetUserId, changes) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw fail("User not found", 404);

  const { role } = changes ?? {};
  await requireNotLastAdmin(target, role);

  const data = buildChanges(changes, actorUserId, targetUserId);

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data,
    include: { _count: { select: { qrCodes: true } } },
  });

  return toPublicUser(updated);
}