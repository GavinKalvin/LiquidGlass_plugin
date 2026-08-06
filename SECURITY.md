# Security policy

## Native-code warning

The optional fog-depth control is a native Node-API module. It receives Electron's macOS native window handle and modifies the alpha of a validated `NSVisualEffectView` in the Electron browser process. A native defect can terminate Obsidian; JavaScript exception handling cannot contain a process-level crash.

Safeguards in v1.5.14 include exact runtime locking, process-ID verification, AppKit main-thread execution, full-window candidate validation, original-alpha restoration, and a disk crash sentinel.

Never disable SIP, library validation, Gatekeeper, or other macOS security controls to run this plugin. If the module does not load normally, use the CSS-only path.

## Privacy

The plugin does not transmit telemetry and does not read note contents. Do not include your vault's `data.json`, `.native-alpha-pending`, backups, or private notes in bug reports.

## Reporting a vulnerability

Please open a GitHub issue without sensitive vault content. For a report that cannot be public, use GitHub's private vulnerability reporting feature if it is enabled for the repository.

Include:

- macOS version and hardware architecture;
- Obsidian and Electron versions;
- whether the native option was enabled;
- the exact action immediately before the failure;
- a minimal crash excerpt with usernames and file paths removed.
