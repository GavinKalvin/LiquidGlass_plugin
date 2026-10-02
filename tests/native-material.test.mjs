import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/native-material.ts", import.meta.url))],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const material = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`,
);
const {
  nativeMaterialAlpha, legacyRetentionToDepth, supportsNativeRuntime,
  migrateNativeDepth, nativeTargetState, isNativeMaterialState,
} = material;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12);

test("old strengths migrate once while retaining the same native state", () => {
  for (const baseline of [0.4, 0.72, 1]) {
    for (let depth = 0; depth <= 150; depth++) {
      const oldFactor = depth <= 100
        ? 1 - 0.65 * Math.pow(depth / 100, 1.43260279979242)
        : 0.35 - 0.17 * ((depth - 100) / 50);
      const migrated = migrateNativeDepth(depth, undefined);
      near(nativeMaterialAlpha(migrated, baseline), baseline * oldFactor);
      near(migrateNativeDepth(migrated, 2), migrated);
    }
  }
  for (let retention = 0; retention <= 100; retention++) {
    const oldFactor = 0.35 + 0.65 * Math.pow(retention / 100, 1.8);
    const migrated = legacyRetentionToDepth(retention);
    assert.ok(migrated >= 50 && migrated <= 150);
    assert.ok(Math.abs(nativeMaterialAlpha(migrated, 1) - oldFactor) < 0.01);
  }
});

test("increasing depth restores more native backdrop, never fades it out", () => {
  for (const baseline of [0.4, 0.72, 1]) {
    let previous = baseline * 0.18;
    for (let depth = 0; depth <= 150; depth += 0.25) {
      const alpha = nativeMaterialAlpha(depth, baseline);
      assert.ok(alpha >= previous - 1e-12);
      assert.ok(alpha <= baseline + 1e-12);
      assert.ok(alpha >= baseline * 0.18 - 1e-12);
      previous = alpha;
    }
    near(nativeMaterialAlpha(0, baseline), baseline * 0.18);
    near(nativeMaterialAlpha(15, baseline), baseline * 0.231);
    near(nativeMaterialAlpha(150, baseline), baseline);
    near(nativeMaterialAlpha(200, baseline), baseline);
    near(nativeMaterialAlpha(-10, baseline), baseline * 0.18);
    assert.ok(Math.abs(nativeMaterialAlpha(50.000001, baseline)
      - nativeMaterialAlpha(50, baseline)) < 1e-8);
  }
});

test("missing and malformed migration values default to a full native backdrop", () => {
  for (const value of [undefined, null, NaN, Infinity, "135"]) {
    assert.equal(migrateNativeDepth(value, undefined), 150);
  }
  assert.equal(migrateNativeDepth(0, undefined), 150);
  assert.equal(migrateNativeDepth(150, undefined), 0);
  assert.equal(migrateNativeDepth(135, 2), 135);
  assert.equal(migrateNativeDepth(200, 2), 150);
  assert.equal(migrateNativeDepth(-20, 2), 0);
  assert.equal(migrateNativeDepth(undefined, undefined, 100), 150);
});

test("enhanced material changes the backdrop, not text or whole-window opacity", () => {
  for (const baseline of [{ alpha: 1, material: 7 }, { alpha: 0.72, material: 13 }]) {
    assert.deepEqual(nativeTargetState(150, baseline, false), baseline);
    assert.deepEqual(nativeTargetState(150, baseline, true), {
      alpha: baseline.alpha, material: 21,
    });
    assert.deepEqual(nativeTargetState(150, baseline, false), baseline);
    assert.equal(nativeTargetState(0, baseline, true).material, 21);
  }
});

test("invalid native state is rejected before applying or capturing a baseline", () => {
  for (const invalid of [null, {}, { alpha: NaN, material: 7 },
    { alpha: Infinity, material: 7 }, { alpha: -0.1, material: 7 },
    { alpha: 1.1, material: 7 }, { alpha: 1, material: 20 },
    { alpha: 1, material: 7.5 }, { alpha: 1, material: "7" }]) {
    assert.equal(isNativeMaterialState(invalid), false);
  }
  assert.ok(isNativeMaterialState({ alpha: 1, material: 7 }));
  assert.ok(isNativeMaterialState({ alpha: 0.72, material: 21 }));
});

test("native path accepts only the listed exact host fingerprints", () => {
  const host = {
    type: "browser", platform: "darwin", arch: "arm64",
    versions: { electron: "39.8.3" },
  };
  assert.ok(supportsNativeRuntime(host, "1.13.4"));
  assert.ok(supportsNativeRuntime(host, "1.13.7"));
  for (const version of ["1.13.1", "1.13.8", "2.0.0", ""]) {
    assert.equal(supportsNativeRuntime(host, version), false);
  }
  for (const altered of [
    { ...host, type: "renderer" },
    { ...host, type: undefined },
    { ...host, platform: "win32" },
    { ...host, arch: "x64" },
    { ...host, versions: { electron: "40.0.0" } },
    { ...host, versions: {} },
  ]) assert.equal(supportsNativeRuntime(altered, "1.13.7"), false);
});
