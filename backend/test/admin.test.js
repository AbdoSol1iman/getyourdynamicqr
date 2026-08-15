import { describe, before, test } from "node:test";
import assert from "node:assert/strict";
import { api, registerAndLogin, getPrisma, uniqueEmail } from "./helpers.js";

// Owner-only user management: list all users, change plans/roles, disable an
// account, and the guards that keep the owner from locking themselves out.
describe("admin user management", () => {
  let admin;
  let adminRow;

  before(async () => {
    admin = await registerAndLogin();
    const prisma = await getPrisma();
    adminRow = await prisma.user.findUnique({ where: { email: admin.email } });
    await prisma.user.update({ where: { id: adminRow.id }, data: { role: "ADMIN" } });
  });

  test("non-admins cannot list users", async () => {
    const user = await registerAndLogin();
    const res = await api("/api/admin/users", { token: user.token });
    assert.equal(res.status, 403);
    assert.match(res.json.message, /Admin access required/);
  });

  test("manual plan change appears in the user list", async () => {
    const user = await registerAndLogin();
    const res = await api("/api/admin/users", { token: admin.token });
    assert.equal(res.status, 200);
    const found = res.json.data.find((u) => u.email === user.email);
    assert.ok(found, "admin can see newly registered users");
    assert.equal(found.planType, "FREE");
    assert.equal(found.isActive, true);

    const row = await (await getPrisma()).user.findUnique({ where: { email: user.email } });
    const upgraded = await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { planType: "PRO" },
    });
    assert.equal(upgraded.status, 200);
    assert.equal(upgraded.json.data.planType, "PRO");

    const plan = await api("/api/billing/plan", { token: user.token });
    assert.equal(plan.json.data.current.planType, "PRO");
  });

  test("promoting a user to admin grants access", async () => {
    const prisma = await getPrisma();
    const user = await registerAndLogin();
    const row = await prisma.user.findUnique({ where: { email: user.email } });
    const res = await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { role: "ADMIN" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.role, "ADMIN");

    // Fresh token, now passes the admin gate.
    const login = await api("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: user.password },
    });
    const list = await api("/api/admin/users", { token: login.json.data.token });
    assert.equal(list.status, 200);
  });

  test("unknown plan / role / boolean values are rejected", async () => {
    const prisma = await getPrisma();
    const user = await registerAndLogin();
    const row = await prisma.user.findUnique({ where: { email: user.email } });

    const badPlan = await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { planType: "LEGENDARY" },
    });
    assert.equal(badPlan.status, 400);

    const badRole = await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { role: "OWNER" },
    });
    assert.equal(badRole.status, 400);

    const badBool = await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { isActive: "yes" },
    });
    assert.equal(badBool.status, 400);
  });

  test("disabling a user blocks login and existing tokens", async () => {
    const prisma = await getPrisma();
    const user = await registerAndLogin();
    const row = await prisma.user.findUnique({ where: { email: user.email } });

    const res = await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { isActive: false },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.isActive, false);

    // Login blocked.
    const login = await api("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: user.password },
    });
    assert.equal(login.status, 403);

    // Existing token blocked on a protected route.
    const plan = await api("/api/billing/plan", { token: user.token });
    assert.equal(plan.status, 403);

    // Re-enabling restores access.
    await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { isActive: true },
    });
    const plan2 = await api("/api/billing/plan", { token: user.token });
    assert.equal(plan2.status, 200);
  });

  test("cannot disable your own account", async () => {
    const res = await api(`/api/admin/users/${adminRow.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { isActive: false },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.message, /own account/);
  });

  test("cannot demote the last admin", async () => {
    const prisma = await getPrisma();
    // Earlier tests may have promoted other users to ADMIN. Reset everyone
    // else to USER so `admin` is the only remaining admin — then demoting it
    // must be refused (no lockout).
    await prisma.user.updateMany({
      where: { id: { not: adminRow.id } },
      data: { role: "USER" },
    });
    const res = await api(`/api/admin/users/${adminRow.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { role: "USER" },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.message, /last admin/);

    // Still an admin afterwards.
    const check = await api("/api/admin/users", { token: admin.token });
    assert.equal(check.status, 200);
  });

  test("missing or unknown target user returns 404", async () => {
    const res = await api("/api/admin/users/nonexistent-id", {
      method: "PATCH",
      token: admin.token,
      body: { planType: "PRO" },
    });
    assert.equal(res.status, 404);
  });

  test("empty update body is rejected", async () => {
    const prisma = await getPrisma();
    const user = await registerAndLogin();
    const row = await prisma.user.findUnique({ where: { email: user.email } });
    const res = await api(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      token: admin.token,
      body: {},
    });
    assert.equal(res.status, 400);
  });
});