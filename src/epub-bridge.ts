export interface EpubGlassAppearance {
  enabled: boolean;
  noteMaterial: boolean;
  textHaloStrength: number;
}

type FrameApplyStatus = "applied" | "inactive" | "pending" | "failed";

interface EpubFrameState {
  contentDocument: Document | null;
  errorReported: boolean;
  frame: HTMLIFrameElement;
  loadHandler: () => void;
}

interface EpubViewState {
  content: HTMLElement;
  frameObserver: MutationObserver;
  frames: Map<HTMLIFrameElement, EpubFrameState>;
  host: EpubHostState;
  leaf: HTMLElement;
  themeColor: string | null;
  themeObserver: MutationObserver;
}

interface EpubHostState {
  appearanceObserver: MutationObserver;
  document: Document;
  structureObserver: MutationObserver;
  syncQueued: boolean;
  views: Map<HTMLElement, EpubViewState>;
}

const EPUB_VIEW_SELECTOR =
  '.workspace-leaf-content[data-type="epub-reader-view"]';
const EPUB_CONTENT_SELECTOR = ":scope > .view-content";
const EPUB_FRAME_SELECTOR = ".epub-view > iframe";
const EPUB_VIEW_CLASS = "liquid-glass-epub-bridge";
const EPUB_DOCUMENT_CLASS = "liquid-glass-epub-content";
const EPUB_STYLE_ID = "liquid-glass-epub-bridge-style";
const EPUB_STYLE_OWNER = "liquid-glass";
const EPUB_THEME_VARIABLE = "--lg-epub-theme-color";
const EPUB_HOST_TEXT_ALPHA_THRESHOLD = 0.25;
const EPUB_PROSE_SELECTOR = `html.${EPUB_DOCUMENT_CLASS} > body :where(p, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, caption, th, td, pre, address):not(:is(svg, svg *, math, math *)):not(:has(img, image, svg, audio, video, canvas, picture, object, embed, iframe, math))`;

/**
 * Bridges Liquid Glass into epub.js' same-origin rendition iframes.
 *
 * The bridge owns only a fixed host tint, one root class and one style element
 * per EPUB document. It clears only root backgrounds and can style guarded
 * semantic prose blocks; media and any text block containing media are
 * excluded from inherited color and halo changes.
 */
export class EpubGlassBridge {
  private hosts = new Map<Document, EpubHostState>();

  constructor(
    private getAppearance: () => EpubGlassAppearance,
    private reportError: (message: string, error: unknown) => void = () => {},
  ) {}

  manageDocument(doc: Document): void {
    if (!this.getAppearance().enabled) {
      this.releaseDocument(doc);
      return;
    }
    if (!doc.body || !doc.defaultView || doc.defaultView.closed) return;
    if (!this.hosts.has(doc)) this.createHost(doc);
    this.refreshDocument(doc);
  }

  refreshDocument(doc: Document): void {
    if (!this.getAppearance().enabled) {
      this.releaseDocument(doc);
      return;
    }
    const host = this.hosts.get(doc);
    if (!host) return;
    this.syncHost(host);
  }

  releaseDocument(doc: Document): void {
    const host = this.hosts.get(doc);
    if (!host) return;

    // Remove the state first so any already queued microtask becomes a no-op.
    this.hosts.delete(doc);
    host.structureObserver.disconnect();
    host.appearanceObserver.disconnect();
    for (const view of Array.from(host.views.values())) this.releaseView(view);
    host.views.clear();
  }

  releaseAll(): void {
    for (const doc of Array.from(this.hosts.keys())) this.releaseDocument(doc);
  }

  private createHost(doc: Document): void {
    const Observer = doc.defaultView?.MutationObserver;
    if (!Observer || !doc.body) return;

    const structureObserver = new Observer((records) => {
      if (records.some((record) => this.isRelevantHostMutation(record))) {
        this.scheduleHostSync(doc);
      }
    });
    const appearanceObserver = new Observer(() => {
      this.scheduleHostSync(doc);
    });
    const host: EpubHostState = {
      appearanceObserver,
      document: doc,
      structureObserver,
      syncQueued: false,
      views: new Map(),
    };

    this.hosts.set(doc, host);
    structureObserver.observe(doc.body, {
      attributeFilter: ["data-type"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    appearanceObserver.observe(doc.body, {
      attributeFilter: ["class"],
      attributes: true,
    });
  }

  private isRelevantHostMutation(record: MutationRecord): boolean {
    if (record.type === "attributes") {
      const target = record.target as Element;
      return target.matches?.(".workspace-leaf-content") ?? false;
    }

    const targetIsEpubView = record.target.nodeType === 1
      && (record.target as Element).closest(EPUB_VIEW_SELECTOR) !== null;
    for (const node of [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]) {
      if (node.nodeType !== 1) continue;
      const element = node as Element;
      if (
        element.matches(EPUB_VIEW_SELECTOR)
        || element.querySelector(EPUB_VIEW_SELECTOR)
        || (
          targetIsEpubView
          && (
            element.matches(".view-content")
            || element.querySelector(".view-content")
          )
        )
      ) return true;
    }
    return false;
  }

  private scheduleHostSync(doc: Document): void {
    const host = this.hosts.get(doc);
    if (!host || host.syncQueued) return;
    host.syncQueued = true;
    Promise.resolve().then(() => {
      const current = this.hosts.get(doc);
      if (current !== host) return;
      host.syncQueued = false;
      this.syncHost(host);
    });
  }

  private syncHost(host: EpubHostState): void {
    const leaves = new Set(
      Array.from(
        host.document.querySelectorAll<HTMLElement>(EPUB_VIEW_SELECTOR),
      ),
    );

    for (const [leaf, view] of Array.from(host.views.entries())) {
      const currentContent = leaf.querySelector<HTMLElement>(EPUB_CONTENT_SELECTOR);
      if (!leaves.has(leaf) || !leaf.isConnected || currentContent !== view.content) {
        this.releaseView(view);
        host.views.delete(leaf);
      }
    }

    for (const leaf of leaves) {
      let view = host.views.get(leaf);
      if (!view) {
        const content = leaf.querySelector<HTMLElement>(EPUB_CONTENT_SELECTOR);
        if (!content) continue;
        view = this.createView(host, leaf, content);
        host.views.set(leaf, view);
      }
      this.syncView(view);
    }
  }

  private createView(
    host: EpubHostState,
    leaf: HTMLElement,
    content: HTMLElement,
  ): EpubViewState {
    const Observer = host.document.defaultView?.MutationObserver ?? MutationObserver;
    let view: EpubViewState;
    const frameObserver = new Observer(() => {
      if (
        !view.leaf.isConnected
        || view.leaf.querySelector(EPUB_CONTENT_SELECTOR) !== view.content
      ) {
        this.scheduleHostSync(host.document);
        return;
      }
      this.syncViewFrames(view);
    });
    const themeObserver = new Observer(() => {
      this.updateViewTheme(view);
      this.syncViewFrames(view);
    });

    view = {
      content,
      frameObserver,
      frames: new Map(),
      host,
      leaf,
      themeColor: null,
      themeObserver,
    };
    frameObserver.observe(content, { childList: true, subtree: true });
    themeObserver.observe(content, {
      attributeFilter: ["style"],
      attributes: true,
    });
    return view;
  }

  private syncView(view: EpubViewState): void {
    this.updateViewTheme(view);
    this.syncViewFrames(view);
  }

  private updateViewTheme(view: EpubViewState): void {
    const candidate = view.content.style.backgroundColor.trim();
    const css = view.host.document.defaultView?.CSS;
    const nextTheme = candidate
      && candidate !== "transparent"
      && (!css || css.supports("color", candidate))
      ? candidate
      : null;
    if (view.themeColor === nextTheme) return;

    view.themeColor = nextTheme;
    if (nextTheme) {
      view.leaf.style.setProperty(EPUB_THEME_VARIABLE, nextTheme);
    } else {
      view.leaf.style.removeProperty(EPUB_THEME_VARIABLE);
    }
  }

  private syncViewFrames(view: EpubViewState): void {
    const frames = new Set(
      Array.from(
        view.content.querySelectorAll<HTMLIFrameElement>(EPUB_FRAME_SELECTOR),
      ).filter((frame) => frame.closest(EPUB_VIEW_SELECTOR) === view.leaf),
    );

    for (const [frame, state] of Array.from(view.frames.entries())) {
      if (!frames.has(frame) || !frame.isConnected) {
        this.releaseFrame(state);
        view.frames.delete(frame);
      }
    }

    for (const frame of frames) {
      if (view.frames.has(frame)) continue;
      const frameState: EpubFrameState = {
        contentDocument: null,
        errorReported: false,
        frame,
        loadHandler: () => {
          if (view.host.views.get(view.leaf) === view) this.syncViewFrames(view);
        },
      };
      frame.addEventListener("load", frameState.loadHandler);
      view.frames.set(frame, frameState);
    }

    let appliedCount = 0;
    let hardFailure = false;
    for (const frameState of view.frames.values()) {
      const status = this.applyFrame(view, frameState);
      if (status === "applied") appliedCount += 1;
      if (status === "failed") hardFailure = true;
    }

    // A hard failure rolls back only this EPUB leaf. Pending frames simply keep
    // the host opaque until their first accessible document is ready.
    if (hardFailure) {
      for (const frameState of view.frames.values()) {
        this.clearFrameDocument(frameState);
      }
      appliedCount = 0;
    }
    view.leaf.classList.toggle(EPUB_VIEW_CLASS, appliedCount > 0);
  }

  private applyFrame(
    view: EpubViewState,
    frameState: EpubFrameState,
  ): FrameApplyStatus {
    const appearance = this.getAppearance();
    const hostBody = view.host.document.body;
    const canRender = appearance.enabled
      && hostBody.classList.contains("is-translucent")
      && !hostBody.classList.contains("is-fullscreen");
    const useMaterial = canRender && appearance.noteMaterial;
    const useHalo = canRender && appearance.textHaloStrength > 0;

    if (!useMaterial && !useHalo) {
      this.clearFrameDocument(frameState);
      return "inactive";
    }

    try {
      const doc = frameState.frame.contentDocument;
      if (!doc?.documentElement) return "pending";
      if (frameState.contentDocument && frameState.contentDocument !== doc) {
        this.clearEpubDocument(frameState.contentDocument);
      }
      frameState.contentDocument = doc;

      const parent = doc.head ?? doc.documentElement;
      const existing = doc.getElementById(EPUB_STYLE_ID);
      if (
        existing
        && (
          existing.tagName !== "STYLE"
          || existing.getAttribute("data-liquid-glass-owner") !== EPUB_STYLE_OWNER
        )
      ) throw new Error(`EPUB document already owns #${EPUB_STYLE_ID}`);

      let style = existing as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement("style");
        style.id = EPUB_STYLE_ID;
        style.dataset.liquidGlassOwner = EPUB_STYLE_OWNER;
        parent.appendChild(style);
      }
      style.textContent = this.buildFrameStyles(view, useMaterial, useHalo);
      doc.documentElement.classList.add(EPUB_DOCUMENT_CLASS);
      frameState.errorReported = false;
      return "applied";
    } catch (error) {
      this.clearFrameDocument(frameState);
      if (!frameState.errorReported) {
        frameState.errorReported = true;
        this.reportError("Liquid Glass could not bridge an EPUB frame", error);
      }
      return "failed";
    }
  }

  private buildFrameStyles(
    view: EpubViewState,
    useMaterial: boolean,
    useHalo: boolean,
  ): string {
    const rules: string[] = [];
    const hostTextColor = useMaterial
      ? transparentHostTextColor(view.host.document)
      : null;
    if (useMaterial) {
      rules.push(`
html.${EPUB_DOCUMENT_CLASS},
html.${EPUB_DOCUMENT_CLASS} > body {
  background-color: transparent !important;
}`);
      if (hostTextColor) {
        rules.push(`
${EPUB_PROSE_SELECTOR} {
  color: ${hostTextColor} !important;
}`);
      }
    }

    if (useHalo) {
      const hostIsDark = view.host.document.body.classList.contains("theme-dark");
      const hostTextIsDark = isDarkCssColor(hostTextColor);
      const dark = hostTextColor
        ? (hostTextIsDark === null ? hostIsDark : !hostTextIsDark)
        : (isDarkCssColor(view.themeColor) ?? hostIsDark);
      rules.push(`
${EPUB_PROSE_SELECTOR} {
  text-shadow: ${epubTextShadow(this.getAppearance().textHaloStrength, dark)} !important;
}`);
    }
    return rules.join("\n");
  }

  private releaseView(view: EpubViewState): void {
    view.frameObserver.disconnect();
    view.themeObserver.disconnect();
    for (const frame of view.frames.values()) this.releaseFrame(frame);
    view.frames.clear();
    view.leaf.classList.remove(EPUB_VIEW_CLASS);
    view.leaf.style.removeProperty(EPUB_THEME_VARIABLE);
  }

  private releaseFrame(state: EpubFrameState): void {
    state.frame.removeEventListener("load", state.loadHandler);
    this.clearFrameDocument(state);
  }

  private clearFrameDocument(state: EpubFrameState): void {
    if (state.contentDocument) this.clearEpubDocument(state.contentDocument);
    try {
      const current = state.frame.contentDocument;
      if (current && current !== state.contentDocument) this.clearEpubDocument(current);
    } catch {
      // A navigated cross-origin document cannot contain a style we can remove.
    }
    state.contentDocument = null;
  }

  private clearEpubDocument(doc: Document): void {
    doc.documentElement?.classList.remove(EPUB_DOCUMENT_CLASS);
    const style = doc.getElementById(EPUB_STYLE_ID);
    if (
      style?.tagName === "STYLE"
      && style.getAttribute("data-liquid-glass-owner") === EPUB_STYLE_OWNER
    ) style.remove();
  }
}

/**
 * A nearly clear viewport exposes Obsidian's material instead of the EPUB
 * theme tint. In that narrow range, inherit Obsidian's normal text color on
 * media-free semantic prose blocks so a light EPUB theme remains readable
 * over dark glass (and vice versa). Media-bearing blocks keep the EPUB color
 * chain intact, including SVG `currentColor`.
 */
function transparentHostTextColor(doc: Document): string | null {
  const view = doc.defaultView;
  if (!view || !doc.body) return null;

  const rootStyle = view.getComputedStyle(doc.documentElement);
  const noteAlpha = Number.parseFloat(
    rootStyle.getPropertyValue("--lg-note-alpha"),
  );
  if (
    !Number.isFinite(noteAlpha)
    || noteAlpha > EPUB_HOST_TEXT_ALPHA_THRESHOLD
  ) return null;

  const bodyStyle = view.getComputedStyle(doc.body);
  const candidate = bodyStyle.getPropertyValue("--text-normal").trim()
    || bodyStyle.color.trim();
  const css = view.CSS;
  if (!candidate || (css && !css.supports("color", candidate))) return null;
  return candidate;
}

function isDarkCssColor(value: string | null): boolean | null {
  if (!value) return null;
  let channels: [number, number, number] | null = null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (hex) {
    const raw = hex[1];
    if (!raw) return null;
    channels = raw.length === 3
      ? [
        parseInt(raw.charAt(0).repeat(2), 16),
        parseInt(raw.charAt(1).repeat(2), 16),
        parseInt(raw.charAt(2).repeat(2), 16),
      ]
      : [
        parseInt(raw.slice(0, 2), 16),
        parseInt(raw.slice(2, 4), 16),
        parseInt(raw.slice(4, 6), 16),
      ];
  } else {
    const rgb = value.match(
      /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i,
    );
    if (rgb) channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  if (!channels?.every(Number.isFinite)) return null;
  const luminance = (
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  ) / 255;
  return luminance < 0.5;
}

function epubTextShadow(strength: number, dark: boolean): string {
  const ratio = Math.min(1, Math.max(0, strength / 100));
  const alpha = ratio * 0.1;
  const blur = 4 + ratio * 8;
  const secondaryBlur = blur * (dark ? 0.5 : 0.42);
  const secondaryAlpha = alpha * (dark ? 0.85 : 0.7);
  const primary = dark ? "245, 248, 255" : "18, 27, 43";
  const secondary = dark ? "0, 0, 0" : "255, 255, 255";
  return [
    `0 1px ${blur.toFixed(1)}px rgba(${primary}, ${alpha.toFixed(3)})`,
    `0 0 ${secondaryBlur.toFixed(1)}px rgba(${secondary}, ${secondaryAlpha.toFixed(3)})`,
  ].join(", ");
}
