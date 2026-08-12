import { describe, before, test } from "node:test";
import assert from "node:assert/strict";
import { api, createAndLogin, createQr, rawGet, registerAndLogin } from "./helpers.js";

// Custom domains: paid-plan gating, validation, unique ownership, the
// host-aware redirect path, and the default-host fallback on delete.
describe("custom domains", () => {
  let pro; // PRO (paid) user
  let domainId;
  let domainName;

  before(async () => {
    pro = await createAndLogin({ planType: "PRO" });
    domainName = `qr-${Date.now()}.testloc.dev`;
    const created = await api("/api/domains", {
      method: "POST",
      token: pro.token,
      body: { domain: domainName },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.isVerified, true);
    domainId = created.json.data.id;
  });

  test("custom domains require a paid plan (403 for FREE)", async () => {
    const free = await registerAndLogin();
    const res = await api("/api/domains", {
      method: "POST",
      token: free.token,
      body: { domain: "free.try.example" },
    });
    assert.equal(res.status, 403);
    assert.match(res.json.message, /Pro plan or higher/);
  });

  test("invalid domain names are rejected", async () => {
    const res = await api("/api/domains", {
      method: "POST",
      token: pro.token,
      body: { domain: "not a domain" },
    });
    assert.equal(res.status, 400);
  });

  test("duplicate domains return 409", async () => {
    const res = await api("/api/domains", {
      method: "POST",
      token: pro.token,
      body: { domain: domainName },
    });
    assert.equal(res.status, 409);
  });

  test("a user can list and delete their own domains", async () => {
    const list = await api("/api/domains", { token: pro.token });
    assert.equal(list.status, 200);
    assert.ok(list.json.data.some((d) => d.id === domainId));
  });

  test("cross-user ownership: another user cannot delete/see the domain", async () => {
    const intruder = await createAndLogin({ planType: "PRO" });
    const list = await api("/api/domains", { token: intruder.token });
    assert.equal(list.json.data.some((d) => d.id === domainId), false);
    const del = await api(`/api/domains/${domainId}`, { method: "DELETE", token: intruder.token });
    assert.equal(del.status, 404);
  });

  test("a QR on a custom domain redirects only on that host", async () => {
    const created = await createQr(pro.token, {
      title: "On my domain",
      destinationUrl: "https://destination.example/page",
      domainId,
    });
    assert.equal(created.status, 201);
    const { shortCode } = created.json.data;
    assert.equal(created.json.data.redirectUrl, `https://${domainName}/q/${shortCode}`);

    // Request with the custom Host header → 302 to the destination.
    const onDomain = await rawGet(`/q/${shortCode}`, { host: domainName });
    assert.equal(onDomain.status, 302);
    assert.equal(onDomain.headers.location, "https://destination.example/page");

    // The same code on an unknown host must not leak another user's QR.
    const unknown = await rawGet(`/q/${shortCode}`, { host: "hacker.example" });
    assert.equal(unknown.status, 404);
  });

  test("deleting a domain falls QRs back to the default host", async () => {
    const owned = await createAndLogin({ planType: "PRO" });
    const d = await api("/api/domains", {
      method: "POST",
      token: owned.token,
      body: { domain: `fallback-${Date.now()}.testloc.dev` },
    });
    const created = await createQr(owned.token, { domainId: d.json.data.id });
    const { id, shortCode } = created.json.data;
    assert.match(created.json.data.redirectUrl, /^https:\/\/fallback-/);

    const del = await api(`/api/domains/${d.json.data.id}`, { method: "DELETE", token: owned.token });
    assert.equal(del.status, 200);

    const updated = await api(`/api/qr/${id}`, { token: owned.token });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.data.redirectUrl, `http://127.0.0.1/q/${shortCode}`);
    assert.equal(updated.json.data.domainId, null);
  });
});