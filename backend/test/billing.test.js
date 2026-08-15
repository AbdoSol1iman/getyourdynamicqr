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
      assert.equal(res.json.data.plans.length, 5);
      const types = res.json.data.plans.map((p) => p.planType);
      assert.deepEqual(types, ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"]);
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
      assert.equal(payment.amountEGP, 500);
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

  // Owner-only: reject/decline a submitted payment, and the customer re-submit.
describe("owner decline + customer resubmit", () => {
  test("a declined payment stays FREE, shows a reason, and can be re-submitted", async () => {
    const prisma = await getPrisma();
    const adminCreds = await registerAndLogin();
    const adminRow = await prisma.user.findUnique({ where: { email: adminCreds.email } });
    await prisma.user.update({ where: { id: adminRow.id }, data: { role: "ADMIN" } });

    // Customer creates + submits a payment.
    const user = await registerAndLogin();
    const pay = await api("/api/billing/pay", {
      method: "POST",
      token: user.token,
      body: { planType: "STARTER", method: "WEPAY" },
    });
    const paymentId = pay.json.data.paymentId;
    const submitted = await api("/api/billing/submit", {
      method: "POST",
      token: user.token,
      body: { paymentId, externalRef: "WEPAY-DECL-111" },
    });
    assert.equal(submitted.status, 200);

    // Admin declines with a reason.
    const declined = await api(`/api/billing/payments/${paymentId}/decline`, {
      method: "POST",
      token: adminCreds.token,
      body: { reason: "Transfer never arrived" },
    });
    assert.equal(declined.status, 200);
    assert.equal(declined.json.data.status, "DECLINED");

    // Plan unchanged.
    const plan = await api("/api/billing/plan", { token: user.token });
    assert.equal(plan.json.data.current.planType, "FREE");
    // The customer's plan state surfaces the decline reason for the UI.
    assert.equal(plan.json.data.declined.paymentId, paymentId);
    assert.equal(plan.json.data.declined.reason, "Transfer never arrived");

    // Declined payment is listed among owner payments with the reason.
    const list = await api("/api/billing/payments", { token: adminCreds.token });
    const row = list.json.data.find((p) => p.id === paymentId);
    assert.equal(row.status, "DECLINED");
    assert.equal(row.declineReason, "Transfer never arrived");

    // Customer re-submits with a new reference -> back to review, reason cleared.
    const resubmit = await api("/api/billing/resubmit", {
      method: "POST",
      token: user.token,
      body: { paymentId, externalRef: "WEPAY-DECL-222" },
    });
    assert.equal(resubmit.status, 200);
    assert.equal(resubmit.json.data.status, "SUBMITTED");

    const after = await api("/api/billing/plan", { token: user.token });
    assert.equal(after.json.data.declined, null);
    const listed = await api("/api/billing/payments", { token: adminCreds.token });
    const row2 = listed.json.data.find((p) => p.id === paymentId);
    assert.equal(row2.status, "SUBMITTED");
    assert.equal(row2.declineReason, null);
  });

  test("declining requires admin and only submitted payments", async () => {
    const prisma = await getPrisma();
    const adminCreds = await registerAndLogin();
    const adminRow = await prisma.user.findUnique({ where: { email: adminCreds.email } });
    await prisma.user.update({ where: { id: adminRow.id }, data: { role: "ADMIN" } });

    const user = await registerAndLogin();
    const pay = await api("/api/billing/pay", {
      method: "POST",
      token: user.token,
      body: { planType: "STARTER", method: "WEPAY" },
    });
    const paymentId = pay.json.data.paymentId;

    // Non-admin cannot decline (403).
    assert.equal(
      (
        await api(`/api/billing/payments/${paymentId}/decline`, {
          method: "POST",
          token: user.token,
          body: { reason: "nope" },
        })
      ).status,
      403
    );

    // PENDING (never submitted) cannot be declined.
    const declined = await api(`/api/billing/payments/${paymentId}/decline`, {
      method: "POST",
      token: adminCreds.token,
      body: { reason: "nope" },
    });
    assert.equal(declined.status, 400);

    // A user cannot resubmit a payment that isn't theirs or isn't declined.
    const other = await registerAndLogin();
    const res = await api("/api/billing/resubmit", {
      method: "POST",
      token: other.token,
      body: { paymentId, externalRef: "WEPAY-X-1" },
    });
    assert.equal(res.status, 404);
  });

  test("resubmit requires a plausible reference and can only resubmit declined payments", async () => {
    const prisma = await getPrisma();
    const admin = await registerAndLogin();
    const adminRow = await prisma.user.findUnique({ where: { email: admin.email } });
    await prisma.user.update({ where: { id: adminRow.id }, data: { role: "ADMIN" } });

    const user = await registerAndLogin();
    const pay = await api("/api/billing/pay", {
      method: "POST",
      token: user.token,
      body: { planType: "STARTER", method: "TELDA" },
    });
    const paymentId = pay.json.data.paymentId;

    // A PENDING payment (never declined) cannot be re-submitted.
    const pending = await api("/api/billing/resubmit", {
      method: "POST",
      token: user.token,
      body: { paymentId, externalRef: "TELDA-X-1" },
    });
    assert.equal(pending.status, 400);

    await api("/api/billing/submit", {
      method: "POST",
      token: user.token,
      body: { paymentId, externalRef: "TELDA-DECL-1" },
    });
    await api(`/api/billing/payments/${paymentId}/decline`, {
      method: "POST",
      token: admin.token,
      body: { reason: "bad ref" },
    });

    const bad = await api("/api/billing/resubmit", {
      method: "POST",
      token: user.token,
      body: { paymentId, externalRef: "x" },
    });
    assert.equal(bad.status, 400);
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