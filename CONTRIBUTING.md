# Contributing

Contributions are welcome, especially reproducible compatibility reports and renderer-performance investigations.

## Development rules

- Preserve the host-owned native material boundary.
- Do not add `scroll`, `wheel`, or `resize` hot-path listeners.
- Do not add polling, large renderer filters, or opacity on text/scroll containers.
- Do not broaden native runtime support without rebuilding and validating the target Electron version.
- Keep interface and Markdown translucency independent.

## Validation checklist

Before submitting a change:

1. Run `pnpm install --frozen-lockfile` and `pnpm run build`.
2. Confirm no renderer `backdrop-filter`, scroll listeners, polling, or observers were introduced.
3. Test reading view and live preview with a long note.
4. Open and close the detached settings window.
5. Toggle native fog off and on; confirm the exact alpha is restored.
6. Resize the window and perform sustained trackpad scrolling.
7. Disable or unload the plugin and verify the native baseline returns.

For native changes, also run `pnpm run build:native` on Apple Silicon and document the exact Electron target.
