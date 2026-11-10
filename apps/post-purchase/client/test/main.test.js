import { test } from "node:test";
import assert from "node:assert/strict";
import { apiPath } from "../src/main.js";

test("uses the shared API version", () => {
  assert.equal(apiPath, "/v1");
});
