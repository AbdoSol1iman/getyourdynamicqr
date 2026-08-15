import { describe, before, test } from "node:test";
import assert from "node:assert/strict";
import { api, createAndLogin, registerAndLogin } from "./helpers.js";

// Plans + wallet billing: plan catalogue, payment creation, confirmation
// that upgrades the user, and all the guard rails (400/404/duplicate).
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

    test("rejects an implausible confirmation reference", async () => {
      const res = await api("/api/billing/confirm", {
        method: "POST",
        token,
        body: { paymentId: payment.paymentId, externalRef: "x" },
      });
      assert.equal(res.status, 400);
    });

    test("confirming upgrades the user's plan", async () => {
      const res = await api("/api/billing/confirm", {
        method: "POST",
        token,
        body: { paymentId: payment.paymentId, externalRef: "WEPAY-XYZ-12345" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.data.planType, "PRO");

      const plan = await api("/api/billing/plan", { token });
      assert.equal(plan.json.data.current.planType, "PRO");
    });

    test("a confirmed payment cannot be confirmed twice", async () => {
      const res = await api("/api/billing/confirm", {
        method: "POST",
        token,
        body: { paymentId: payment.paymentId, externalRef: "WEPAY-XYZ-99999" },
      });
      assert.equal(res.status, 400);
      assert.match(res.json.message, /already confirmed/);
    });

    test("paying for the plan you are already on is rejected", async () => {
      const res = await api("/api/billing/pay", {
        method: "POST",
        token,
        body: { planType: "PRO", method: "WEPAY" }, // already PRO now
      });
      assert.equal(res.status, 400);
      assert.match(res.json.message, /already on the Pro plan/);
    });

    test("a user cannot confirm someone else's payment (404)", async () => {
      const victim = await registerAndLogin();
      const created = await api("/api/billing/pay", {
        method: "POST",
        token: victim.token,
        body: { planType: "ENTERPRISE", method: "TELDA" },
      });
      const thief = await registerAndLogin();
      const res = await api("/api/billing/confirm", {
        method: "POST",
        token: thief.token,
        body: { paymentId: created.json.data.paymentId, externalRef: "TELDA-XXX-11111" },
      });
      assert.equal(res.status, 404);
    });
  });

  describe("plan gating after upgrade", () => {
    test("a FREE user blocked at 3 QRs can create more after upgrading", async () => {
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
      const confirmRes = await api("/api/billing/confirm", {
        method: "POST",
        token: user.token,
        body: { paymentId: pay.json.data.paymentId, externalRef: "WEPAY-GROW-77777" },
      });
      assert.equal(confirmRes.status, 200);

      assert.equal((await create("Grow 5")).status, 201);
    });
  });
});