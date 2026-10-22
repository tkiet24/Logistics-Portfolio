import test from "node:test";
import assert from "node:assert/strict";
import { formatStat } from "../src/core/stats.js";

test("GPA count-up preserves two decimal places instead of rounding to an integer", () => {
  assert.equal(formatStat(3.65, 0, 2), "0.00");
  assert.equal(formatStat(3.65, 0.5, 2), "1.82");
  assert.equal(formatStat(3.65, 1, 2), "3.65");
});

test("integer statistics retain their format and append suffixes only on completion", () => {
  assert.equal(formatStat(2, 0.5), "1");
  assert.equal(formatStat(2, 1), "2");
  assert.equal(formatStat(5, 0.5, 0, "+"), "3");
  assert.equal(formatStat(5, 1, 0, "+"), "5+");
  assert.equal(formatStat(3.65, 2, 2), "3.65");
});
