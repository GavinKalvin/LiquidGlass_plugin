import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"],
});
const hostRequire = createRequire(import.meta.url);
class PluginStub {
  stored = null;
  async loadData() { return this.stored; }
  async saveData(value) { this.stored = structuredClone(value); }
}
const pluginModule = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, {
  module: pluginModule, exports: pluginModule.exports,
  require(name) {
    return name === "obsidian" ? {
      Plugin: PluginStub, PluginSettingTab: class {}, FileSystemAdapter: class {},
      Notice: class {}, Setting: class {}, apiVersion: "1.13.7",
    } : hostRequire(name);
  },
  console: { warn() {}, error() {} }, window: { clearTimeout() {} },
});
const LiquidGlassPlugin = pluginModule.exports.default;
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
  const plugin = new LiquidGlassPlugin();
  const bridge = { getNativeWindowHandle: () => Buffer.alloc(8) };
  const doc = {
    defaultView: { electronWindow: bridge, closed: false },
    body: { classList: { contains: () => true } },
  };
  const native = {
    current: { alpha: 0.72, material: 7 }, writes: [],
    getState() { return { ...this.current }; },
    setState(handle, state) {
      this.current = { ...state };
      this.writes.push({ ...state });
      return true;
    },
    inspect: () => "mock full-window view",
  };
  plugin.primaryDocument = doc;
  plugin.getNativeAddon = () => native;
  plugin.withNativeSentinel = (callback) => callback();
  Object.assign(plugin.settings, {
    enabled: true, nativeFogEnabled: true, nativeGlassDepth: 150,
    nativeEnhancedMaterial: true,
  });
  return { plugin, native, doc, bridge };
}

test("settings migrate only once and retain opt-in material preferences", async () => {
  const plugin = new LiquidGlassPlugin();
  plugin.stored = { nativeGlassDepth: 0, nativeFogEnabled: true };
  await plugin.loadSettings();
  assert.equal(plugin.settings.nativeGlassDepth, 150);
  assert.equal(plugin.stored.nativeDepthSchema, 2);
  assert.equal(plugin.settings.nativeEnhancedMaterial, false);
  await plugin.loadSettings();
  assert.equal(plugin.settings.nativeGlassDepth, 150);
  plugin.stored = { nativeGlassDepth: 135, nativeDepthSchema: 2, nativeEnhancedMaterial: true };
  await plugin.loadSettings();
  assert.equal(plugin.settings.nativeGlassDepth, 135);
  assert.equal(plugin.settings.nativeEnhancedMaterial, true);
});

test("enhanced material applies once, uses original baseline, and restores both properties", () => {
  const { plugin, native, doc } = fixture();
  plugin.applyNativeFog(doc);
  assert.deepEqual(native.current, { alpha: 0.72, material: 21 });
  plugin.applyNativeFog(doc);
  assert.equal(native.writes.length, 1);
  plugin.settings.nativeGlassDepth = 0;
  plugin.applyNativeFog(doc);
  assert.ok(Math.abs(native.current.alpha - 0.72 * 0.18) < 1e-12);
  plugin.settings.nativeEnhancedMaterial = false;
  plugin.settings.nativeGlassDepth = 150;
  plugin.applyNativeFog(doc);
  assert.deepEqual(native.current, { alpha: 0.72, material: 7 });
  plugin.settings.nativeFogEnabled = false;
  plugin.applyNativeFog(doc);
  assert.deepEqual(native.current, { alpha: 0.72, material: 7 });
  assert.equal(plugin.nativeWindows.size, 0);
});

test("a failed readback restores the baseline and disables the native experiment", () => {
  const { plugin, native, doc } = fixture();
  const normalSet = native.setState.bind(native);
  native.setState = (handle, state) => {
    normalSet(handle, state);
    if (state.material === 21) native.current.alpha = 0.1;
    return true;
  };
  plugin.applyNativeFog(doc);
  assert.equal(plugin.settings.nativeFogEnabled, false);
  assert.deepEqual(native.current, { alpha: 0.72, material: 7 });
  assert.equal(plugin.nativeWindows.size, 0);
});

test("failed restoration keeps the captured baseline for a later retry", () => {
  const { plugin, native, doc, bridge } = fixture();
  plugin.applyNativeFog(doc);
  const normalSet = native.setState.bind(native);
  native.setState = () => false;
  plugin.restoreNativeBridge(bridge);
  assert.deepEqual(plain(plugin.nativeWindows.get(bridge).baseline), { alpha: 0.72, material: 7 });
  native.setState = normalSet;
  plugin.restoreNativeBridge(bridge);
  assert.deepEqual(native.current, { alpha: 0.72, material: 7 });
  assert.equal(plugin.nativeWindows.size, 0);
});

test("auxiliary windows are never given native material ownership", () => {
  const { plugin, native, doc } = fixture();
  const auxiliary = {
    ...doc,
    defaultView: { electronWindow: { getNativeWindowHandle: () => Buffer.alloc(8) } },
  };
  plugin.applyNativeFog(auxiliary);
  assert.equal(native.writes.length, 0);
  assert.equal(plugin.nativeWindows.size, 0);
});
