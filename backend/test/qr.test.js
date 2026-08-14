import { describe, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  createQr,
  registerAndLogin,
  createAndLogin,
} from "./helpers.js";
import { checkQrHealth } from "../src/services/qr.health.js";

// The base URL the redirect engine builds QR links from (pointed at the live
// test server by helpers.startApi).
const testBase = () => process.env.BASE_URL.replace(/\/$/, "");

// QR lifecycle, plan gating, ownership checks, soft delete, and the public
// redirect engine (302 + scan logging).
describe("qr codes", () => {
  let user; // a high-limit user (so multiple create/update tests never trip 403)
  before(async () => {
    user = await createAndLogin({ planType: "ENTERPRISE" });
    await createQr(user.token); // warm-up / baseline QR
  });

  test("creating a QR requires authentication", async () => {
    const res = await api("/api/qr", { method: "POST", body: { title: "x", destinationUrl: "https://example.com" } });
    assert.equal(res.status, 401);
  });

  test("creating a QR rejects an invalid destination URL", async () => {
    const res = await createQr(user.token, { destinationUrl: "not-a-url" });
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "destinationUrl must be a valid http(s) URL");
  });

  test("creating a QR returns a short code, image, and our redirect URL", async () => {
    const res = await createQr(user.token, { title: "Menu", destinationUrl: "https://resto.example/menu" });
    assert.equal(res.status, 201);
    assert.equal(res.json.success, true);
    assert.ok(res.json.data.shortCode.match(/^[A-Za-z0-9]{6}$/));
    assert.ok(res.json.data.qrImage.startsWith("data:image/png;base64,"));
    // The QR encodes OUR url, never the destination (spec §32).
    assert.equal(res.json.data.redirectUrl, `${testBase()}/q/${res.json.data.shortCode}`);
    assert.equal(res.json.data.destinationUrl, "https://resto.example/menu");
    // Health: every check passes for a healthy QR — image generated, endpoint
    // reachable, and the redirect resolves to the destination. (localhost is
    // allowed in the test env, so noLocalhost passes.)
    assert.equal(res.json.data.health.ok, true);
    assert.deepEqual(res.json.data.health.checks, {
      noLocalhost: true,
      qrImage: true,
      reachable: true,
      targetMatch: true,
    });
  });

  test("list and get return a QR image for every card", async () => {
    const mine = await api("/api/qr", { token: user.token });
    assert.equal(mine.status, 200);
    assert.ok(mine.json.data.length >= 1);
    assert.ok(mine.json.data.every((qr) => qr.redirectUrl && qr.redirectUrl.length > 0));
    assert.ok(
      mine.json.data.every((qr) => qr.qrImage && qr.qrImage.startsWith("data:image/png;base64,"))
    );

    const one = await api(`/api/qr/${mine.json.data[0].id}`, { token: user.token });
    assert.equal(one.status, 200);
    assert.ok(one.json.data.qrImage.startsWith("data:image/png;base64,"));
  });

  test("GET /api/qr/:id/health re-verifies an existing QR", async () => {
    const created = await createQr(user.token, { destinationUrl: "https://health.example" });
    const id = created.json.data.id;
    const res = await api(`/api/qr/${id}/health`, { token: user.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.health.ok, true);
    assert.equal(res.json.data.health.checks.reachable, true);
    assert.equal(res.json.data.health.checks.targetMatch, true);
    assert.ok(res.json.data.qrImage.startsWith("data:image/png;base64,"));
    // Ownership is enforced on the health endpoint too.
    const intruder = await registerAndLogin();
    assert.equal((await api(`/api/qr/${id}/health`, { token: intruder.token })).status, 404);
  });

  test("health flags localhost redirect URLs in production but allows them in dev", async () => {
    const args = {
      redirectUrl: "http://localhost:3000/q/ABC123",
      qrImage: "data:image/png;base64,AAAA",
      destinationUrl: "https://example.com",
    };
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const prod = await checkQrHealth(args);
      assert.equal(prod.checks.noLocalhost, false);
      assert.equal(prod.ok, false);
    } finally {
      process.env.NODE_ENV = original;
    }
    const dev = await checkQrHealth(args);
    assert.equal(dev.checks.noLocalhost, true);
  });

  test("list returns only the user's own QR codes", async () => {
    const other = await registerAndLogin();
    const intruder = await createQr(other.token, { title: "Intruder" });

    const mine = await api("/api/qr", { token: user.token });
    const others = await api("/api/qr", { token: other.token });
    assert.equal(mine.status, 200);
    assert.ok(mine.json.data.length >= 1);
    // Each list item carries a scan-count and a redirect URL.
    assert.ok(mine.json.data.every((qr) => typeof qr.scanCount === "number"));
    // The intruder QR appears in the owner's list but never in another user's.
    assert.ok(others.json.data.some((qr) => qr.id === intruder.json.data.id));
    assert.equal(mine.json.data.some((qr) => qr.id === intruder.json.data.id), false);
  });

  test("a user cannot read, edit, or delete another user's QR", async () => {
    const owner = await registerAndLogin();
    const created = await createQr(owner.token);
    const id = created.json.data.id;

    const intruder = await registerAndLogin();
    assert.equal((await api(`/api/qr/${id}`, { token: intruder.token })).status, 404);
    const patch = await api(`/api/qr/${id}`, {
      method: "PATCH",
      token: intruder.token,
      body: { title: "Hijacked" },
    });
    assert.equal(patch.status, 404);
    const del = await api(`/api/qr/${id}`, { method: "DELETE", token: intruder.token });
    assert.equal(del.status, 404);
  });

  test("updating the destination keeps the same short code", async () => {
    const created = await createQr(user.token, { title: "Before", destinationUrl: "https://a.example/1" });
    const { id, shortCode } = created.json.data;
    const patch = await api(`/api/qr/${id}`, {
      method: "PATCH",
      token: user.token,
      body: { title: "After", destinationUrl: "https://b.example/2" },
    });
    assert.equal(patch.status, 200);
    assert.equal(patch.json.data.shortCode, shortCode);
    assert.equal(patch.json.data.destinationUrl, "https://b.example/2");
    assert.equal(patch.json.data.redirectUrl, `${testBase()}/q/${shortCode}`);
  });

  test("FREE plan limit: a fourth QR is rejected with 403", async () => {
    const fresh = await registerAndLogin(); // a brand-new FREE user has 0 QRs
    for (let i = 0; i < 3; i++) {
      const ok = await createQr(fresh.token, { title: `QR ${i}` });
      assert.equal(ok.status, 201);
    }
    const fourth = await createQr(fresh.token, { title: "One too many" });
    assert.equal(fourth.status, 403);
    assert.match(fourth.json.message, /Free plan's limit of 3/);
  });

  test("ENTERPRISE users are not limited by a QR count", async () => {
    const ent = await createAndLogin({ planType: "ENTERPRISE" });
    for (let i = 0; i < 4; i++) {
      assert.equal((await createQr(ent.token, { title: `Ent ${i}` })).status, 201);
    }
  });

  test("soft-deleted QRs stop redirecting", async () => {
    const created = await createQr(user.token, { destinationUrl: "https://gone.example" });
    const { id, shortCode } = created.json.data;
    assert.equal((await api(`/q/${shortCode}`)).status, 302);
    const del = await api(`/api/qr/${id}`, { method: "DELETE", token: user.token });
    assert.equal(del.status, 200);
    assert.equal((await api(`/q/${shortCode}`)).status, 404);
  });

  test("inactive QRs stop redirecting but re-activation restores them", async () => {
    const created = await createQr(user.token, { destinationUrl: "https://toggle.example" });
    const { id, shortCode } = created.json.data;

    const off = await api(`/api/qr/${id}`, {
      method: "PATCH",
      token: user.token,
      body: { isActive: false },
    });
    assert.equal(off.status, 200);
    assert.equal((await api(`/q/${shortCode}`)).status, 404);

    const on = await api(`/api/qr/${id}`, {
      method: "PATCH",
      token: user.token,
      body: { isActive: true },
    });
    assert.equal(on.status, 200);
    assert.equal((await api(`/q/${shortCode}`)).status, 302);
  });

  test("an unknown short code returns 404", async () => {
    const res = await api("/q/ZZZZZZ");
    assert.equal(res.status, 404);
  });
});