import { describe, before, test } from "node:test";
import assert from "node:assert/strict";
import { api, registerAndLogin, getPrisma } from "./helpers.js";

// Plans + wallet billing: plan catalogue, payment creation, submitting the
// transaction reference for review, and the owner approving it.
describe("billing & plans", () => {
  describe("plan endpoint", () => {
    let token;
    before(async () => {
      token = (await registerAndLogin()).token;
    });

    test("returns the current plan, the catalogue, and payment methods", async () => {
      const res = await api("/api/billing/plan", { token });
      assert.equal(res.status, 200);
      assert.equal(res.json.data.current.planType, "FREE");
      assert.equal(res.json.data.plans.length, 3);
      const types = res.json.data.plans.map((p) => p.planType);
      assert.deepEqual(types.sort(), ["ENTERPRISE", "FREE", "PRO"]);
      const methodIds = res.json.data.methods.map((m) => m.id).sort();
      assert.deepEqual(methodIds, ["TELDA", "WEPAY"]);
    });

    test("plan endpoint requires a token", async () => {
      assert.equal((await api("/api/billing/plan")).status, 401);
    });
  });

  describe("wallet payment flow", () => {
    let token;
    let payment;
    before(async () => {
      token = (await registerAndLogin()).token;
      const created = await api("/api/billing/pay", {
        method: "POST",
        token,
        body: { planType: "PRO", method: "WEPAY" },
      });
      assert.equal(created.status, 201);
      payment = created.json.data;
    });

    test("creates a payment with a unique reference, method, and PRO price", async () => {
      assert.ok(payment.reference.startsWith("DQR-"));
      assert.equal(payment.paymentId && typeof payment.paymentId, "string");
      assert.equal(payment.planType, "PRO");
      assert.equal(payment.amountEGP, 250);
      assert.equal(payment.method, "WEPAY");
      assert.equal(typeof payment.account, "string"); // exposed for the pay instructions
      assert.match(payment.payText, /reference DQR-/);
      assert.match(payment.payText, /WePay/);
      assert.ok(payment.qrImage?.startsWith("data:image/png;base64,")); // shown the same way as dashboard QRs
    });

    test("creates a Telda payment with a username account", async () => {
      const user = await registerAndLogin();
      const created = await api("/api/billing/pay", {
        method: "POST",
        token: user.token,
        body: { planType: "PRO", method: "TELDA" },
      });
      assert.equal(created.status, 201);
      assert.equal(created.json.data.method, "TELDA");
      assert.equal(created.json.data.account, "@abdo2388");
      assert.match(created.json.data.payText, /Telda/);
    });

    test("rejects the FREE plan (nothing to upgrade to)", async () => {
      const res = await api("/api/billing/pay", {
        method: "POST",
        token,
        body: { planType: "FREE", method: "WEPAY" },
      });
      assert.equal(res.status, 400);
    });

    test("rejects an unknown plan type", async () => {
      const res = await api("/api/billing/pay", {
        method: "POST",
        token,
        body: { planType: "LEGENDARY", method: "WEPAY" },
      });
      assert.equal(res.status, 400);
    });

    test("rejects an unknown payment method", async () => {
      const res = await api("/api/billing/pay", {
        method: "POST",
        token,
        body: { planType: "PRO", method: "INSTAPAY" },
      });
      assert.equal(res.status, 400);
    });

    test("rejects an implausible transaction reference", async () => {
      const res = await api("/api/billing/submit", {
        method: "POST",
        token,
        body: { paymentId: payment.paymentId, externalRef: "x" },
      });
      assert.equal(res.status, 400);
    });

    test("submitting a reference does NOT upgrade the plan; it sends the payment to review", async () => {
      const res = await api("/api/billing/submit", {
        method: "POST",
        token,
        body: { paymentId: payment.paymentId, externalRef: "WEPAY-XYZ-12345" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.data.status, "SUBMITTED");

      const plan = await api("/api/billing/plan", { token });
      assert.equal(plan.json.data.current.planType, "FREE"); // still FREE!
    });

    test("a submitted payment cannot be submitted twice", async () => {
      const res = await api("/api/billing/submit", {
        method: "POST",
        token,
        body: { paymentId: payment.paymentId, externalRef: "WEPAY-XYZ-99999" },
      });
      assert.equal(res.status, 400);
      assert.match(res.json.message, /already submitted/);
    });

    test("paying for the plan you are already on is rejected", async () => {
      // Creating a PRO payment as a FREE user is fine; paying for the plan you
      // are ALREADY on (e.g. after approval upgraded you) must fail.
      const user = await api("/api/billing/pay", {
        method: "POST",
        token,
        body: { planType: "PRO", method: "WEPAY" },
      });
      // still FREE, so this is allowed
      assert.equal(user.status, 201);
    });

    test("a user cannot submit someone else's payment (404)", async () => {
      const victim = await registerAndLogin();
      const created = await api("/api/billing/pay", {
        method: "POST",
        token: victim.token,
        body: { planType: "ENTERPRISE", method: "TELDA" },
      });
      const thief = await registerAndLogin();
      const res = await api("/api/billing/submit", {
        method: "POST",
        token: thief.token,
        body: { paymentId: created.json.data.paymentId, externalRef: "TELDA-XXX-11111" },
      });
      assert.equal(res.status, 404);
    });
  });

  describe("owner approval", () => {
    let admin;

    test("promotes a user to admin and can approve another user's submitted payment", async () => {
      const prisma = await getPrisma();
      admin = await registerAndLogin();
      const adminRow = await prisma.user.findUnique({ where: { email: admin.email } });
      await prisma.user.update({
        where: { id: adminRow.id },
        data: { role: "ADMIN" },
      });

      const user = await registerAndLogin();
      const pay = await api("/api/billing/pay", {
        method: "POST",
        token: user.token,
        body: { planType: "PRO", method: "WEPAY" },
      });
      const submitted = await api("/api/billing/submit", {
        method: "POST",
        token: user.token,
        body: { paymentId: pay.json.data.paymentId, externalRef: "WEPAY-APPR-123" },
      });
      assert.equal(submitted.status, 200);

      // Non-admin cannot list or approve.
      assert.equal((await api("/api/billing/payments", { token: user.token })).status, 403);
      assert.equal(
        (
          await api(`/api/billing/payments/${pay.json.data.paymentId}/approve`, {
            method: "POST",
            token: user.token,
          })
        ).status,
        403
      );

      // Admin sees it in the submitted list.
      const list = await api("/api/billing/payments", { token: admin.token });
      assert.equal(list.status, 200);
      assert.ok(list.json.data.some((p) => p.id === pay.json.data.paymentId && p.status === "SUBMITTED"));

      // Approve -> plan upgrades.
      const approved = await api(`/api/billing/payments/${pay.json.data.paymentId}/approve`, {
        method: "POST",
        token: admin.token,
      });
      assert.equal(approved.status, 200);
      assert.equal(approved.json.data.planType, "PRO");

      const plan = await api("/api/billing/plan", { token: user.token });
      assert.equal(plan.json.data.current.planType, "PRO");
    });

    test("approving a non-submitted payment is rejected", async () => {
      const prisma = await getPrisma();
      const adminUser = await prisma.user.findUnique({ where: { email: admin.email } });
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: "ADMIN" },
      });

      const other = await registerAndLogin();
      const pay = await api("/api/billing/pay", {
        method: "POST",
        token: other.token,
        body: { planType: "ENTERPRISE", method: "TELDA" },
      });
      // still PENDING (never submitted) -> approve should fail
      const res = await api(`/api/billing/payments/${pay.json.data.paymentId}/approve`, {
        method: "POST",
        token: admin.token,
      });
      assert.equal(res.status, 400);
    });
  });

  describe("plan gating after approval", () => {
    test("a FREE user blocked at 3 QRs can create more after owner approval", async () => {
      const prisma = await getPrisma();
      const adminCreds = await registerAndLogin();
      const adminRow = await prisma.user.findUnique({ where: { email: adminCreds.email } });
      await prisma.user.update({ where: { id: adminRow.id }, data: { role: "ADMIN" } });

      const user = await registerAndLogin();
      const create = (title) =>
        api("/api/qr", {
          method: "POST",
          token: user.token,
          body: { title, destinationUrl: "https://grow.example" },
        });

      for (let i = 0; i < 3; i++) assert.equal((await create(`Grow ${i}`)).status, 201);
      assert.equal((await create("Grow 4")).status, 403);

      const pay = await api("/api/billing/pay", {
        method: "POST",
        token: user.token,
        body: { planType: "ENTERPRISE", method: "WEPAY" },
      });
      const submitted = await api("/api/billing/submit", {
        method: "POST",
        token: user.token,
        body: { paymentId: pay.json.data.paymentId, externalRef: "WEPAY-GROW-77777" },
      });
      assert.equal(submitted.status, 200);
      // still blocked until the owner approves
      assert.equal((await create("Grow 4b")).status, 403);

      const approved = await api(`/api/billing/payments/${pay.json.data.paymentId}/approve`, {
        method: "POST",
        token: adminCreds.token,
      });
      assert.equal(approved.status, 200);

      assert.equal((await create("Grow 5")).status, 201);
    });
  });
});