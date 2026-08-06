# Compatibility

## Supported baseline

The CSS material path requires macOS and Obsidian's **Translucent window** option. It does not install or replace the native vibrancy material.

## Native fog-depth profile

The prebuilt `vibrancy_alpha.node` in v1.5.14 is accepted only when all of the following match:

| Component | Required value |
| --- | --- |
| Operating system | macOS |
| Architecture | arm64 / Apple Silicon |
| Obsidian API version | 1.13.4 |
| Electron | 39.8.3 |
| Process | Electron browser/main process |

The plugin fails closed when any fingerprint differs. The CSS-only Liquid Glass path remains available.

## Unsupported environments

- Windows and Linux;
- Intel macOS or Rosetta execution;
- a different Obsidian or Electron version for the native fog control;
- detached settings and auxiliary windows for native fog control.

Do not remove the runtime checks merely to make the module load on a newer version. Revalidate Electron's native window structure, rebuild against the matching headers, and perform a new scroll/resize regression pass first.
