# Architecture

## Ownership boundary

Obsidian owns the native macOS translucent-window material. The plugin normally owns only static CSS state attached to Obsidian documents.

The optional v1.5.15 native profile narrows its ownership to the primary workspace window and one property: the alpha of Electron's existing full-window `NSVisualEffectView`. It does not create, replace, or change the material type.

The user-facing translucency-depth value is not written as an absolute view alpha. It is mapped relative to the captured host baseline through a safe curve whose physical range is `baseline` at 0% to `baseline × 0.35` at 100%. This makes higher values produce stronger translucency without allowing the clearest setting to hide the blur and vibrancy view.

## Renderer layers

1. Obsidian creates the native behind-window material.
2. The plugin clears only the host color layer required to reveal that material.
3. Fixed interface shells receive the interface alpha.
4. The fixed EPUB reading toolbar receives the same interface alpha; its scroll/paged control uses translucent static fills.
5. The fixed Markdown `.view-content` shell receives the note alpha.
6. A bridged EPUB `.view-content` receives the same alpha, tinted by the EPUB reader's selected background theme.
7. The same-origin EPUB iframe clears only its `html` and `body` background colors. At near-clear note alpha, guarded semantic prose blocks inherit Obsidian's normal text color for contrast; blocks containing media are excluded so SVG `currentColor`, author media, and descendant rendering remain unchanged.
8. CodeMirror, reading-mode nodes, and EPUB rendition nodes move text only and do not carry filters or material color.

This separation prevents interface transmission from multiplying the note transmission and avoids applying opacity to glyphs or cursors.

## Native path

The renderer obtains Electron's current-window handle through Obsidian's existing bridge. The addon itself is loaded in the browser process and verifies its PID. AppKit work is executed on the main thread.

The target is accepted only when the content view contains exactly one direct `NSVisualEffectView` that:

- belongs to the same `NSWindow`;
- uses `NSVisualEffectBlendingModeBehindWindow`;
- covers the complete content bounds within a one-point tolerance.

Settings and auxiliary documents still receive safe CSS management but never native fog ownership.

## Transaction and recovery

Before the first write, the plugin captures the target's baseline alpha. Every native setter call is wrapped by `.native-alpha-pending`. A normal return removes the sentinel; an interrupted call leaves it behind, causing native deepening to be disabled at the next startup.

Disabling, restoring the v1.5.10 baseline, or unloading the plugin reacquires the current native handle and restores the captured alpha. Failed restoration retains state for a later retry.

## Performance boundary

Native setters run only during enable/disable, debounced setting changes, and window lifecycle operations. No native or CSS update is scheduled by document scrolling or resizing.

The EPUB bridge has no polling, animation frame, scroll, wheel, or resize path. Scoped observers react only when an EPUB leaf, rendition iframe, selected theme, host appearance class, or Obsidian CSS theme changes. The bridge never observes mutations inside the book document.
