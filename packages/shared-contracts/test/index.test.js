import { test } from "node:test";
import assert from "node:assert/strict";
import { API_VERSION, SHIPMENT_STATUSES } from "../src/index.js";

test("contract exports", () => {
  assert.equal(API_VERSION, "v1");
  assert.ok(SHIPMENT_STATUSES.includes("IN_TRANSIT"));
});
