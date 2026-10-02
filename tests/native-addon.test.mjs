import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

// These checks load the addon in this test process, not in Obsidian. A null
// handle never creates an NSWindow/NSApplication or touches a live user view.
const supported = process.platform === "darwin" && process.arch === "arm64";
const addon = supported ? createRequire(import.meta.url)("../vibrancy_material.node") : null;
const nilHandle = Buffer.alloc(8);

test("v2 native addon loads and identifies the current test process", { skip: !supported }, () => {
  assert.equal(addon.stateVersion(), 2);
  assert.equal(addon.processId(), process.pid);
});

test("native state setter rejects malformed values before touching a view", { skip: !supported }, () => {
  for (const invalid of [null, {}, { alpha: NaN, material: 7 },
    { alpha: Infinity, material: 7 }, { alpha: -0.1, material: 7 },
    { alpha: 1.1, material: 7 }, { alpha: 1, material: 20 },
    { alpha: 1, material: 7.5 }, { alpha: 1, material: 1e100 },
    { alpha: 1, material: "7" }]) {
    assert.throws(() => addon.setState(nilHandle, invalid));
  }
  assert.throws(() => addon.getState("not a buffer"));
  assert.throws(() => addon.getState(Buffer.alloc(1)));
});

test("missing native view fails closed without changing a window", { skip: !supported }, () => {
  assert.equal(addon.getState(nilHandle), null);
  assert.equal(addon.setState(nilHandle, { alpha: 1, material: 21 }), false);
});
