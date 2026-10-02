# Compatibility

## Supported baseline

The CSS material path requires macOS and Obsidian's **Translucent window** option. It does not install or replace the native vibrancy material.

## Native fog-depth profile

The v2 `vibrancy_material.node` in v1.5.20 is accepted only when all of the following match:

| Component | Required value |
| --- | --- |
| Operating system | macOS |
| Architecture | arm64 / Apple Silicon |
| Obsidian API version | 1.13.4 or 1.13.7 |
| Electron | 39.8.3 |
| Process | Electron browser/main process |

The plugin fails closed when any fingerprint differs. The CSS-only Liquid Glass path remains available.

The 1.13.7 profile was added after inspecting this machine's installed Obsidian archive and Electron framework: the runtime remains Electron 39.8.3, and the host still uses sidebar vibrancy for translucent windows. This does not substitute for the addon's live check of exactly one full-window behind-window visual-effect view. Live native application and visual regression remain pending until the installed plugin is reloaded.

Native depth accepts 0–150, with higher values restoring more of the native backdrop. At 150 the captured host alpha is restored; 0 retains 18% of that alpha. This fixes the reversed visual direction reported on this machine: fading out the backdrop can reveal an opaque window rather than stronger translucency. The optional enhanced profile changes only the validated view's public material to under-window, and restores the captured original material when disabled. Its visual improvement must be confirmed on the user's system after reload.

## Unsupported environments

- Windows and Linux;
- Intel macOS or Rosetta execution;
- a different Obsidian or Electron version for the native fog control;
- detached settings and auxiliary windows for native fog control.

Do not remove the runtime checks merely to make the module load on a newer version. Inspect the host's material contract, verify the native window structure, rebuild against matching headers if Electron changes, and perform a new scroll/resize regression pass before claiming live compatibility.
