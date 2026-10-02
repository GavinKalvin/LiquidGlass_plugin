# Liquid Glass for Obsidian

An experimental macOS-only Obsidian plugin that makes the workspace, Markdown, Current Note AI sidebar, and supported EPUB reading surfaces genuinely translucent while preserving a stable scrolling path.

V1.5.21 fixes overlapping slider values while retaining v1.5.20's native-depth direction correction and reversible under-window material experiment. Depth 150 now corresponds to v1.5.19's clearest setting at 0; additional material clarity must be checked on the user's system after reload.

[简体中文说明](README.zh-CN.md)

> [!IMPORTANT]
> The bundled optional native translucency-depth control is intentionally locked to **macOS arm64, Obsidian 1.13.4 or 1.13.7, and Electron 39.8.3**. On any other runtime it fails safely and leaves Obsidian's native material unchanged. Native window structure is checked again before application.

## What it does

- Uses Obsidian's own macOS translucent-window material as the single backdrop source.
- Controls interface and document translucency independently.
- Keeps material color on fixed viewport shells rather than CodeMirror or reading-mode scrolling nodes.
- Adapts Current Note AI 0.1.3 through a right-sidebar-only static material layer that preserves readable cards, messages, diffs, and composer controls.
- Supports [EPUB Reader and Highlighter v0.2.1](https://github.com/okkio-31mon/epub-reader-highlighter) by [@okkio-31mon](https://github.com/okkio-31mon) through a scoped same-origin iframe bridge that keeps images and media untouched; near-clear, media-free EPUB prose inherits Obsidian's text color for contrast. Thanks to its author for the reader this compatibility layer adapts.
- Applies the interface material to EPUB's fixed reading toolbar and translucent scroll/paged controls.
- Adapts Gallery Explorer's main workspace view and fixed toolbar without changing its cards, covers, SVG, or media rendering.
- Uses one inline slider value with non-wrapping layout; older Obsidian versions receive one plain-text fallback instead of a duplicate icon-button label.
- Offers a direction-corrected main-window-only control for the contribution of Electron's full-window `NSVisualEffectView`, plus an optional experimental under-window material profile.
- Preserves the static text halo requested by the original user, with an independent 0–100% control.
- Provides a one-click return to the v1.5.10 native-material baseline.

This project does **not** reproduce Apple's private Liquid Glass refraction shaders. It uses public macOS visual-effect material plus restrained CSS surfaces.

## Stability principles

The renderer path deliberately avoids techniques that previously caused text flicker, resize lag, and apparent scroll overshoot:

- no `scroll`, `wheel`, or `resize` listeners;
- no polling or `requestAnimationFrame`; scoped EPUB observers only track view, iframe, and theme lifecycle changes;
- no renderer `backdrop-filter` or large filtered layers;
- no opacity applied to text, cursors, or Markdown scrolling containers;
- no mutation of Electron `setVibrancy()` or `setBackgroundColor()`;
- no native calls from a scrolling or resizing hot path.

The v1.5.10 Markdown rendering path remains unchanged; v1.5.15 added a separately scoped EPUB content path, v1.5.16 extended it to the fixed reading toolbar, and v1.5.17 adds a separately scoped Current Note AI sidebar path.

## Compatibility

| Feature | Supported environment |
| --- | --- |
| Stable CSS material | macOS Obsidian with **Translucent window** enabled |
| Current Note AI material | Current Note AI 0.1.3 in the right sidebar |
| EPUB material | EPUB Reader and Highlighter 0.2.1 with a same-origin epub.js rendition |
| Gallery material | Gallery Explorer (`gallery-explorer-view`) in the main workspace |
| Native fog-depth control | macOS arm64 + Obsidian 1.13.4 or 1.13.7 + Electron 39.8.3 |
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
└── vibrancy_material.node
```

Then:

1. Open **Settings → Appearance** and enable **Translucent window**.
2. Open **Settings → Community plugins** and enable **Liquid Glass**.
3. Open the Liquid Glass settings page.

If macOS blocks the unsigned local native module, do not disable SIP or weaken system security. Restore the v1.5.10 baseline and use the CSS-only path.

## Settings

- **Interface light transmission** — controls fixed interface surfaces only.
- **Note light transmission** — controls fixed Markdown and supported EPUB viewports.
- **Continuous note glass** — enables the stable Markdown/EPUB viewport material.
- **Deepen native translucency** — enables native backdrop adjustment for the main workspace window.
- **Native translucency depth** — 0–150, with the direction corrected in v1.5.20: 0 is the weakest native backdrop contribution; 150 restores the captured full backdrop (equivalent to v1.5.19's 0). Lowering the whole view's alpha does not independently reduce fog and can reveal an opaque window underneath. Old values migrate once without changing their existing native alpha. Text opacity is never changed.
- **Enhanced backdrop material (experimental)** — uses the public macOS under-window material on the existing native view. Try it at depth 150 for additional translucency; its appearance depends on macOS and the active theme. Turning it off restores the captured original material, without creating a second native layer.
- **Restore v1.5.10** — restores the native material without resetting note, interface, radius, or halo preferences.
- **Text halo** — optional static glyph softening; 0% disables it completely.

## Safety design

The native control is isolated behind several guards:

- exact runtime fingerprinting;
- browser-process PID verification;
- main-thread AppKit access;
- selection of exactly one full-window, behind-window `NSVisualEffectView`;
- main-workspace ownership only—settings and auxiliary windows are skipped;
- per-window alpha and material baseline capture, readback, and restoration;
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

The native script downloads the Electron 39.8.3 headers through `node-gyp`, builds an arm64 Node-API bundle, copies it to `vibrancy_material.node`, and applies an ad-hoc signature for local loading. Build it before running `pnpm test` on macOS arm64; native tests use only a null handle and never create or focus a window.

## Privacy

The plugin has no telemetry, analytics, or network requests. It does not read note or EPUB text. The only disk write outside normal Obsidian plugin settings is the temporary `.native-alpha-pending` crash sentinel in the plugin directory.

## Project documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Compatibility](COMPATIBILITY.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).
