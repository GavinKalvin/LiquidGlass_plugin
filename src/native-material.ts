// Alpha is the presence of the whole native backdrop, not just its fog.
// On this host, fading it out reveals the opaque window underneath. Higher
// depth must therefore restore MORE of the backdrop, not less of it.
export const NATIVE_DEPTH_MAX = 150;
export const NATIVE_DEPTH_SCHEMA = 2;
export const ENHANCED_NATIVE_MATERIAL = 21; // NSVisualEffectMaterialUnderWindowBackground
const ORIGINAL_MATERIAL_FLOOR = 0.35;
const EXTENDED_MATERIAL_FLOOR = 0.18;
const RETENTION_CURVE_EXPONENT = 1.8;
const DEPTH_CURVE_EXPONENT = 1.43260279979242;

export const NATIVE_PROFILE = {
  arch: "arm64",
  electron: "39.8.3",
  obsidian: ["1.13.4", "1.13.7"] as readonly string[],
  platform: "darwin",
} as const;

interface NativeRuntimeFingerprint {
  arch: string;
  platform: string;
  type?: string;
  versions: { electron?: string };
}

export function supportsNativeRuntime(
  runtime: NativeRuntimeFingerprint,
  obsidianVersion: string,
): boolean {
  return runtime.type === "browser"
    && runtime.platform === NATIVE_PROFILE.platform
    && runtime.arch === NATIVE_PROFILE.arch
    && runtime.versions.electron === NATIVE_PROFILE.electron
    && NATIVE_PROFILE.obsidian.includes(obsidianVersion);
}

export function nativeMaterialAlpha(depth: number, baselineAlpha: number): number {
  const boundedDepth = NATIVE_DEPTH_MAX
    - Math.min(NATIVE_DEPTH_MAX, Math.max(0, depth));
  const materialFactor = boundedDepth <= 100
    ? 1 - (1 - ORIGINAL_MATERIAL_FLOOR)
      * Math.pow(boundedDepth / 100, DEPTH_CURVE_EXPONENT)
    : ORIGINAL_MATERIAL_FLOOR
      - (ORIGINAL_MATERIAL_FLOOR - EXTENDED_MATERIAL_FLOOR)
        * ((boundedDepth - 100) / (NATIVE_DEPTH_MAX - 100));
  return Math.min(1, Math.max(0, baselineAlpha * materialFactor));
}

export function legacyRetentionToDepth(retention: number): number {
  const retentionRatio = Math.min(1, Math.max(0, retention / 100));
  const legacyFactor = ORIGINAL_MATERIAL_FLOOR
    + (1 - ORIGINAL_MATERIAL_FLOOR)
      * Math.pow(retentionRatio, RETENTION_CURVE_EXPONENT);
  const normalizedReduction = (1 - legacyFactor)
    / (1 - ORIGINAL_MATERIAL_FLOOR);
  return NATIVE_DEPTH_MAX - Math.round(
    100 * Math.pow(normalizedReduction, 1 / DEPTH_CURVE_EXPONENT),
  );
}

export function migrateNativeDepth(
  depth: unknown,
  schema: unknown,
  legacyRetention?: unknown,
): number {
  if (typeof depth === "number" && Number.isFinite(depth)) {
    const bounded = Math.min(NATIVE_DEPTH_MAX, Math.max(0, depth));
    return schema === NATIVE_DEPTH_SCHEMA ? bounded : NATIVE_DEPTH_MAX - bounded;
  }
  return typeof legacyRetention === "number" && Number.isFinite(legacyRetention)
    ? legacyRetentionToDepth(legacyRetention) : NATIVE_DEPTH_MAX;
}

export interface NativeMaterialState {
  alpha: number;
  material: number;
}

const PUBLIC_MATERIALS = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17, 18, 21, 22,
]);

export function isNativeMaterialState(value: unknown): value is NativeMaterialState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<NativeMaterialState>;
  return typeof state.alpha === "number" && Number.isFinite(state.alpha)
    && state.alpha >= 0 && state.alpha <= 1
    && typeof state.material === "number" && PUBLIC_MATERIALS.has(state.material);
}

export function nativeTargetState(
  depth: number,
  baseline: NativeMaterialState,
  enhanced: boolean,
): NativeMaterialState {
  return {
    alpha: nativeMaterialAlpha(depth, baseline.alpha),
    material: enhanced ? ENHANCED_NATIVE_MATERIAL : baseline.material,
  };
}
