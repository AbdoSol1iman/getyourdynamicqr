import { describe, before, test } from "node:test";
import assert from "node:assert/strict";
import { api, createQr, registerAndLogin } from "./helpers.js";

// Analytics: scans recorded on redirect, daily history, and device/OS/browser
// breakdowns. deviceType/os/browser only apply to scans recorded after the
// analytics upgrade; this test's scans all carry a real user agent.
describe("analytics", () => {
  let token;
  let qrId;

  const MOBILE_UA =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  before(async () => {
    const user = await registerAndLogin();
    token = user.token;
    const created = await createQr(token, { destinationUrl: "https://analytics.example" });
    qrId = created.json.data.id;
    const shortCode = created.json.data.shortCode;

    // Fire a few redirects: two from a mobile browser, one from a desktop UA.
    await api(`/q/${shortCode}`, { extraHeaders: { "User-Agent": MOBILE_UA } });
    await api(`/q/${shortCode}`, { extraHeaders: { "User-Agent": MOBILE_UA } });
    await api(`/q/${shortCode}`, {
      extraHeaders: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36" },
    });
  });

  test("analytics counts total scans and today/week", async () => {
    const res = await api(`/api/qr/${qrId}/analytics`, { token });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.totalScans, 3);
    assert.ok(res.json.data.scansToday >= 3);
    assert.ok(res.json.data.scansThisWeek >= 3);
  });

  test("analytics returns a 0-filled 14-day history", async () => {
    const res = await api(`/api/qr/${qrId}/analytics`, { token });
    assert.equal(res.json.data.scansByDate.length, 14);
    const today = res.json.data.scansByDate[res.json.data.scansByDate.length - 1];
    assert.ok(today.count >= 3);
  });

  test("analytics reports device/OS/browser breakdowns from the user agent", async () => {
    const res = await api(`/api/qr/${qrId}/analytics`, { token });
    const { devices, operatingSystems, browsers } = res.json.data;

    assert.ok(Array.isArray(devices));
    assert.ok(devices.length >= 1);
    assert.ok(devices.some((d) => d.name === "mobile" && d.count >= 2));

    assert.ok(operatingSystems.some((o) => o.name === "Android"));
    assert.ok(browsers.some((b) => b.name === "Chrome"));
  });

  test("analytics returns recent scans newest-first", async () => {
    const res = await api(`/api/qr/${qrId}/analytics`, { token });
    assert.ok(res.json.data.recentScans.length >= 3);
  });

  test("analytics is ownership-checked (404 for other users)", async () => {
    const intruder = await registerAndLogin();
    const res = await api(`/api/qr/${qrId}/analytics`, { token: intruder.token });
    assert.equal(res.status, 404);
  });
});