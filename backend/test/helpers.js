// test/helpers.js
// Test helpers and an isolated test environment, shared by every *.test.js.
//
// IMPORTANT: this module swaps DATABASE_URL to the dedicated `dynamic_qr_test`
// database and raises the rate-limit ceilings so routine test traffic never
// trips the limiters. Tests that want to exercise rate limiting set their own
// low RATE_LIMIT_* values BEFORE importing this module (all app imports below
// are dynamic, so those overrides are honoured).
import "dotenv/config";
import http from "node:http";
import { after } from "node:test";

process.env.NODE_ENV = "test";

const raw = (process.env.DATABASE_URL || "").trim().replace(/^"|"$/g, "");
if (!raw) {
  throw new Error("DATABASE_URL is missing — copy backend/.env.example to backend/.env first.");
}
const testUrl = raw.replace(/\/[^/?]+(\?|$)/, "/dynamic_qr_test$1");
if (testUrl === raw) {
  throw new Error("Could not derive the test database URL from DATABASE_URL");
}
process.env.DATABASE_URL = testUrl;

// Use 127.0.0.1 as the base host so the redirect engine's default-host check
// (req.hostname === getBaseHost()) matches the URL the tests request.
process.env.BASE_URL = process.env.BASE_URL || "http://127.0.0.1";

// Raise the in-memory rate-limit ceilings for normal tests. A dedicated
// rate-limit test file overrides these back down before the app is imported.
process.env.RATE_LIMIT_API_MAX = process.env.RATE_LIMIT_API_MAX || "100000";
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX || "100000";
process.env.RATE_LIMIT_REDIRECT_MAX = process.env.RATE_LIMIT_REDIRECT_MAX || "100000";

let appPromise;
function getApp() {
  if (!appPromise) {
    appPromise = import("../src/app.js").then((mod) => mod.default);
  }
  return appPromise;
}

let server;
let baseUrl;

export async function startApi() {
  if (server) return baseUrl;
  const app = await getApp();
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

// Send a JSON request to the API under test and return { status, headers, json }.
export async function api(path, { method = "GET", token, body, extraHeaders } = {}) {
  const base = await startApi();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  Object.assign(headers, extraHeaders || {});

  const res = await fetch(base + path, {
    method,
    headers,
    redirect: "manual",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON responses (e.g. redirects) are handled via status/headers
  }
  return { status: res.status, headers: res.headers, json };
}

// Send a raw GET with a chosen Host header. fetch() (Node's Undici) refuses to
// override Host, so custom-domain redirect tests need this.
export async function rawGet(path, { host = "127.0.0.1", userAgent = "test-agent" } = {}) {
  await startApi();
  const port = new URL(baseUrl).port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { Host: host, "User-Agent": userAgent, Connection: "close" },
      },
      (res) => {
        const location = res.headers.location || null;
        const status = res.statusCode;
        res.resume();
        res.on("end", () => resolve({ status, headers: { location } }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// Unique emails keep every test run independent, even on a database that has
// already been used by a previous run.
let emailCounter = 0;
export function uniqueEmail(prefix = "user") {
  return `${prefix}_${Date.now()}_${emailCounter++}@test.dev`;
}

export const TEST_PASSWORD = "password123";

export async function registerUnique(email = uniqueEmail(), password = TEST_PASSWORD) {
  return {
    email,
    password,
    ...(await api("/api/auth/register", {
      method: "POST",
      body: { email, password },
    })),
  };
}

// Registers a user and logs in, returning their Bearer token.
export async function registerAndLogin() {
  const { email, password } = await registerUnique();
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return { email, password, token: login.json.data.token };
}

// Creates a user row directly (controlling planType) and returns credentials
// to log in via the normal API.
export async function createUserWithPlan({ planType = "FREE", email = uniqueEmail() } = {}) {
  const { default: bcrypt } = await import("bcrypt");
  const prisma = await getPrisma();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  await prisma.user.create({ data: { email, passwordHash, planType } });
  return { email, password: TEST_PASSWORD };
}

export async function createAndLogin({ planType = "FREE", email = uniqueEmail() } = {}) {
  const creds = await createUserWithPlan({ planType, email });
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: creds.email, password: creds.password },
  });
  return { ...creds, token: login.json.data.token };
}

export async function createQr(token, overrides = {}) {
  return api("/api/qr", {
    method: "POST",
    token,
    body: {
      title: overrides.title || "Test QR",
      destinationUrl: overrides.destinationUrl || "https://example.com/landing",
      ...(overrides.domainId ? { domainId: overrides.domainId } : {}),
    },
  });
}

// The Prisma client bound to the test database (same singleton the app uses).
let prismaPromise;
export function getPrisma() {
  if (!prismaPromise) {
    prismaPromise = import("../src/prisma.js").then((mod) => mod.prisma);
  }
  return prismaPromise;
}

// Close the app server and the DB connection so the test process can exit.
async function shutdown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  try {
    const prisma = await getPrisma();
    await prisma.$disconnect();
  } catch {
    // app was never started; nothing to disconnect
  }
}
after(shutdown);