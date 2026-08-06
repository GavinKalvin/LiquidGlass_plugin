# Changelog

All notable changes to this project are documented here.

## 1.5.14 — 2026-08-06

### Fixed

- Replaced the reversed “system fog retained” control with an intuitive **native translucency depth** control.
- Defined 0% as the exact captured Obsidian baseline and 100% as the clearest safe-glass endpoint.
- Added a visual-preserving migration from the v1.5.13 retention value to the new depth value, so old 0% becomes new 100%, old 100% becomes new 0%, and the established 65% visual point remains approximately 65%.

### Preserved

- The native material floor, baseline-relative restoration, renderer scroll path, CSS, and native binary are unchanged.

## 1.5.13 — 2026-08-06

### Fixed

- Replaced the absolute `0–1` native view-alpha mapping with a baseline-relative safe-translucency curve.
- Kept 0% as the clearest setting without hiding the macOS blur, vibrancy, and material layer.
- Made 100% restore the captured Obsidian baseline instead of assuming that the host alpha is always exactly `1.0`.
- Reapplied the target when the host resets the native view behind the plugin's cached state.
- Removed the silent 100% → 65% preference rewrite when native deepening is enabled.

### Preserved

- The v1.5.10 renderer benchmark and its scroll/resize hot path remain unchanged.
- The native binary and its runtime, main-window, main-thread, uniqueness, and crash-sentinel guards remain unchanged.

## 1.5.12 — 2026-08-05

### Fixed

- Restricted native fog ownership to the primary workspace window.
- Prevented Obsidian's detached `about:blank` settings window from disabling and rolling back the working main-window material.
- Changed the native selector to require exactly one full-window, behind-window `NSVisualEffectView` rather than exactly one visual-effect child of any size.
- Preserved the native retention preference when the feature is toggled off.
- Retained native restore state when a restore attempt fails, allowing a later retry.

### Added

- Continuous native fog retention control from 0% to 100%.
- Runtime locks for macOS arm64, Obsidian 1.13.4, and Electron 39.8.3.
- Main-process PID and AppKit main-thread validation.
- Crash sentinel and one-click v1.5.10 native-material restoration.
- English open-source documentation and reproducible native build metadata.

### Preserved

- The complete v1.5.10 CSS benchmark, byte-for-byte.
- Independent interface and Markdown transmission controls.
- Static text halo without scroll-time style updates.

## 1.5.10

- Established the stable Core-owned material architecture.
- Removed plugin ownership of Electron vibrancy and background color.
- Removed scroll/resize compensation, renderer blur, dynamic color sampling, polling, and broad transparency selectors.
