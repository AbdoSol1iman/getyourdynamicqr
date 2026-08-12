import { describe, before, test } from "node:test";
import assert from "node:assert/strict";
import { api, registerUnique, TEST_PASSWORD } from "./helpers.js";

// Auth: registration validation, duplicate detection, login, and the protected
// /api/auth/me endpoint.
describe("auth", () => {
  before(() => api("/api/auth/me")); // warm up the server

  test("register rejects an invalid email", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { email: "not-an-email", password: TEST_PASSWORD },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.success, false);
  });

  test("register rejects a password shorter than 8 characters", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { email: "short@test.dev", password: "short" },
    });
    assert.equal(res.status, 400);
  });

  test("register succeeds and returns no password hash", async () => {
    const res = await registerUnique();
    assert.equal(res.status, 201);
    assert.equal(res.json.success, true);
    assert.ok(res.json.data.id);
    assert.equal(res.json.data.email, res.email);
    assert.equal(res.json.data.planType, "FREE");
    assert.equal(Object.hasOwn(res.json.data, "passwordHash"), false);
  });

  test("registering the same email twice returns 409", async () => {
    const first = await registerUnique();
    const second = await api("/api/auth/register", {
      method: "POST",
      body: { email: first.email, password: TEST_PASSWORD },
    });
    assert.equal(second.status, 409);
    assert.equal(second.json.message, "Email already registered");
  });

  test("login rejects a wrong password with 401", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: "nobody@test.dev", password: TEST_PASSWORD },
    });
    assert.equal(res.status, 401);
  });

  test("login returns a JWT for valid credentials", async () => {
    const { email } = await registerUnique();
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email, password: TEST_PASSWORD },
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.token);
    assert.equal(res.json.data.user.email, email);
  });

  test("/api/auth/me requires a token", async () => {
    const res = await api("/api/auth/me");
    assert.equal(res.status, 401);
  });

  test("/api/auth/me returns the current user for a valid token", async () => {
    const { email } = await registerUnique();
    const login = await api("/api/auth/login", {
      method: "POST",
      body: { email, password: TEST_PASSWORD },
    });
    const res = await api("/api/auth/me", { token: login.json.data.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.userId, login.json.data.user.id);
  });
});