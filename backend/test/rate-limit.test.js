// Rate limiting uses its own process with a low auth limit, so this file MUST
// set the env variable before helpers.js runs (helpers otherwise raises it).
process.env.RATE_LIMIT_AUTH_MAX = "3";

const helpers = await import("./helpers.js");
const { api, startApi, registerUnique } = helpers;

import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("rate limiting", () => {
  test("the auth limiter returns 429 once the window is exhausted", async () => {
    await startApi();
    for (let i = 0; i < 3; i++) {
      assert.equal((await registerUnique()).status, 201);
    }
    // 4th auth request in the window → 429 with a stable error body.
    const blocked = await registerUnique();
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.success, false);

    // Standard rate-limit headers are present.
    assert.equal(blocked.headers.get("ratelimit-limit"), "3");
  });
});