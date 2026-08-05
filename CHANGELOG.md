# Changelog

All notable changes to this project are documented here.

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
