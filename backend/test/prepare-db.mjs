// test/prepare-db.mjs
// Prepares the isolated test database (dynamic_qr_test) before the tests run:
//   1. creates the database if it does not exist yet
//   2. applies every Prisma migration to it
// Runs automatically through the `pretest` npm script, so tests never touch
// the development database. The migration that `npx prisma migrate deploy`
// runs reads DATABASE_URL from here (allowed to point at any Postgres), while
// the app under test reads the same test URL from its own environment.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

function buildTestUrl() {
  const raw = (process.env.DATABASE_URL || "").trim().replace(/^"|"$/g, "");
  if (!raw) {
    throw new Error(
      "DATABASE_URL is missing — copy backend/.env.example to backend/.env and set it first."
    );
  }
  // Swap only the database name (preserves credentials, port and any
  // query params like ?sslmode=require).
  const replaced = raw.replace(/\/[^/?]+(\?|$)/, "/dynamic_qr_test$1");
  if (replaced === raw) {
    throw new Error("Could not derive the test database URL from DATABASE_URL");
  }
  return { raw, testUrl: replaced };
}

const { raw, testUrl } = buildTestUrl();
const u = new URL(raw);

// 1. Create the database if it does not exist. The app role often owns the
// database but may not have CREATEDB, so if this fails we fail fast with a
// message telling the user how to create it manually.
{
  const admin = new pg.Client({
    host: u.hostname || "localhost",
    port: u.port || 5432,
    user: u.username,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    database: "postgres",
  });
  let connected = false;
  try {
    await admin.connect();
    connected = true;
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      "dynamic_qr_test",
    ]);
    if (exists.rowCount === 0) {
      await admin.query("CREATE DATABASE dynamic_qr_test");
      console.log("Created database dynamic_qr_test");
    }
  } catch (err) {
    if (!connected || String(err.message).toLowerCase().includes("password")) {
      throw new Error(
        "Could not reach Postgres to manage the test database: " + err.message
      );
    }
    throw new Error(
      "Could not create the test database (role lacks CREATEDB). Create it manually " +
        "with `createdb dynamic_qr_test`, then rerun `npm test`.\n  " + err.message
    );
  } finally {
    await admin.end().catch(() => {});
  }
}

// 2. Apply all migrations to the test database.
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Test database ready: " + testUrl);