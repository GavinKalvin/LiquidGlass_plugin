# Liquid Glass for Obsidian

An experimental macOS-only Obsidian plugin that makes the workspace and Markdown surface genuinely translucent while preserving a stable scrolling path.

[简体中文说明](README.zh-CN.md)

> [!IMPORTANT]
> The optional native fog-depth control included in v1.5.12 is intentionally locked to **macOS arm64, Obsidian 1.13.4, and Electron 39.8.3**. On any other runtime it fails safely and leaves Obsidian's native material unchanged.

## What it does

- Uses Obsidian's own macOS translucent-window material as the single backdrop source.
- Controls interface and Markdown translucency independently.
- Keeps material color on fixed viewport shells rather than CodeMirror or reading-mode scrolling nodes.
- Offers an optional main-window-only control for reducing the opacity of Electron's full-window `NSVisualEffectView`.
- Preserves the static text halo requested by the original user, with an independent 0–100% control.
- Provides a one-click return to the v1.5.10 native-material baseline.

This project does **not** reproduce Apple's private Liquid Glass refraction shaders. It uses public macOS visual-effect material plus restrained CSS surfaces.

## Stability principles

The renderer path deliberately avoids techniques that previously caused text flicker, resize lag, and apparent scroll overshoot:

- no `scroll`, `wheel`, or `resize` listeners;
- no polling, `requestAnimationFrame`, or DOM observers;
- no renderer `backdrop-filter` or large filtered layers;
- no opacity applied to text, cursors, or Markdown scrolling containers;
- no mutation of Electron `setVibrancy()` or `setBackgroundColor()`;
- no native calls from a scrolling or resizing hot path.

The v1.5.10 CSS benchmark is preserved byte-for-byte in v1.5.12.

## Compatibility

| Feature | Supported environment |
| --- | --- |
| Stable CSS material | macOS Obsidian with **Translucent window** enabled |
| Native fog-depth control | macOS arm64 + Obsidian 1.13.4 + Electron 39.8.3 |
| Windows / Linux | Not supported |
| Intel Mac / Rosetta | Native fog-depth binary not supported |

See [COMPATIBILITY.md](COMPATIBILITY.md) for the exact safety boundary.

## Installation

### Prebuilt local installation

Copy these four files into your vault:

```text
<vault>/.obsidian/plugins/liquid-glass/
├── main.js
├── manifest.json
├── styles.css
└── vibrancy_alpha.node
```

Then:

1. Open **Settings → Appearance** and enable **Translucent window**.
2. Open **Settings → Community plugins** and enable **Liquid Glass**.
3. Open the Liquid Glass settings page.

If macOS blocks the unsigned local native module, do not disable SIP or weaken system security. Restore the v1.5.10 baseline and use the CSS-only path.

## Settings

- **Interface light transmission** — controls fixed interface surfaces only.
- **Note light transmission** — controls the fixed Markdown viewport only.
- **Continuous note glass** — enables the stable Markdown viewport material.
- **Deepen native translucency** — lowers the native fog layer of the main workspace window.
- **System fog retained** — 100% equals the v1.5.10 baseline; lower values reveal more of the wallpaper or application behind Obsidian.
- **Restore v1.5.10** — restores the native material without resetting note, interface, radius, or halo preferences.
- **Text halo** — optional static glyph softening; 0% disables it completely.

## Safety design

The native control is isolated behind several guards:

- exact runtime fingerprinting;
- browser-process PID verification;
- main-thread AppKit access;
- selection of exactly one full-window, behind-window `NSVisualEffectView`;
- main-workspace ownership only—settings and auxiliary windows are skipped;
- per-window baseline capture and restoration;
- a disk crash sentinel that disables the experiment after an interrupted native call.

This is still native experimental software. Read [SECURITY.md](SECURITY.md) before enabling the native control.

## Building

Requirements:

- macOS on Apple Silicon;
- Node.js and pnpm;
- Xcode Command Line Tools.

Build the Obsidian plugin bundle:

```bash
pnpm install --frozen-lockfile
pnpm run build
```

Rebuild the version-locked native module:

```bash
pnpm run build:native
```

The native script downloads the Electron 39.8.3 headers through `node-gyp`, builds an arm64 Node-API bundle, copies it to `vibrancy_alpha.node`, and applies an ad-hoc signature for local loading.

## Privacy

The plugin has no telemetry, analytics, or network requests. It does not read note contents. The only disk write outside normal Obsidian plugin settings is the temporary `.native-alpha-pending` crash sentinel in the plugin directory.

## Project documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Compatibility](COMPATIBILITY.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).
