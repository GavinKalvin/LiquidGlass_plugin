import {
  App,
  FileSystemAdapter,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  apiVersion,
} from "obsidian";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { isAbsolute, join } from "path";

interface LiquidGlassSettings {
  enabled: boolean;
  interfaceTransparency: number;
  noteTransparency: number;
  radius: number;
  borderOpacity: number;
  shadowStrength: number;
  textHaloStrength: number;
  noteMaterial: boolean;
  nativeFogEnabled: boolean;
  nativeFogRetention: number;
}

interface LegacySettings extends Partial<LiquidGlassSettings> {
  transparency?: number;
  opacity?: number;
  blur?: number;
  floatBlur?: number;
  saturation?: number;
  noteSheet?: boolean;
  motion?: boolean;
  polishMedia?: boolean;
}

const DEFAULT_SETTINGS: LiquidGlassSettings = {
  enabled: true,
  interfaceTransparency: 94,
  noteTransparency: 92,
  radius: 18,
  borderOpacity: 46,
  shadowStrength: 14,
  textHaloStrength: 0,
  noteMaterial: true,
  nativeFogEnabled: false,
  nativeFogRetention: 100,
};

interface NativeWindowBridge {
  getNativeWindowHandle(): Uint8Array;
}

interface NativeRemoteProcess {
  arch: string;
  pid: number;
  platform: string;
  type?: string;
  versions: {
    electron?: string;
  };
}

interface NativeRemote {
  process: NativeRemoteProcess;
  require(modulePath: string): unknown;
}

interface NativeHostWindow extends Window {
  electron?: {
    remote?: NativeRemote;
  };
  electronWindow?: NativeWindowBridge;
}

interface NativeVibrancyAddon {
  getAlpha(handle: Uint8Array): number;
  inspect(handle: Uint8Array): string;
  processId(): number;
  setAlpha(handle: Uint8Array, alpha: number): boolean;
}

interface NativeWindowState {
  appliedAlpha: number;
  baselineAlpha: number;
  document: Document;
}

const NATIVE_RUNTIME = {
  arch: "arm64",
  electron: "39.8.3",
  obsidian: "1.13.4",
  platform: "darwin",
} as const;

const ROOT_CLASS = "liquid-glass-enabled";
const NOTE_MATERIAL_CLASS = "liquid-glass-note-material";
const TEXT_HALO_CLASS = "liquid-glass-text-halo";
const REMOVED_CLASSES = [
  "liquid-glass-material",
  "liquid-glass-note-sheet",
  "liquid-glass-motion",
  "liquid-glass-polish-media",
  "liquid-glass-resizing",
  "liquid-glass-window-resizing",
  "liquid-glass-pane-dragging",
] as const;
const CSS_VARIABLES = [
  "--lg-interface-alpha",
  "--lg-note-alpha",
  "--lg-radius",
  "--lg-border-opacity",
  "--lg-shadow-strength",
  "--lg-text-halo-alpha",
  "--lg-text-halo-blur",
] as const;

export default class LiquidGlassPlugin extends Plugin {
  settings: LiquidGlassSettings = { ...DEFAULT_SETTINGS };
  private primaryDocument: Document | null = null;
  private managedDocuments = new Set<Document>();
  private saveTimer: number | null = null;
  private nativeApplyTimer: number | null = null;
  private nativeAddon: NativeVibrancyAddon | null = null;
  private nativeAddonPath: string | null = null;
  private nativeSentinelPath: string | null = null;
  private nativeWindows = new Map<NativeWindowBridge, NativeWindowState>();
  private nativeErrorNotified = false;

  async onload(): Promise<void> {
    await this.loadSettings();
    const recoveredNativeCrash = await this.recoverNativeCrashSentinel();
    this.primaryDocument = document;

    this.addRibbonIcon("sparkles", "切换 Liquid Glass", () => {
      void this.toggleEnabled();
    });

    this.addCommand({
      id: "toggle-liquid-glass",
      name: "切换 Liquid Glass 效果",
      callback: () => {
        void this.toggleEnabled();
      },
    });

    this.addCommand({
      id: "restore-liquid-glass-material",
      name: "恢复标准 Liquid Glass 材质",
      callback: () => {
        void this.applyLiquidGlassPreset();
      },
    });

    this.addCommand({
      id: "restore-liquid-glass-v1510-native-material",
      name: "仅恢复 v1.5.10 原生雾层",
      callback: () => {
        void this.restoreNativeBenchmark();
      },
    });

    this.addSettingTab(new LiquidGlassSettingTab(this.app, this));

    // Obsidian owns every native macOS window material. This plugin only
    // attaches static CSS state to documents exposed by the workspace API.
    this.manageDocument(document);
    this.registerEvent(
      this.app.workspace.on("window-open", (_workspaceWindow, win) => {
        this.manageDocument(win.document);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("window-close", (_workspaceWindow, win) => {
        this.releaseDocument(win.document);
      }),
    );
    this.app.workspace.onLayoutReady(() => {
      this.refreshDocuments();
      if (recoveredNativeCrash) {
        new Notice("原生透景上次未正常完成，已自动恢复 v1.5.10 安全基准");
      }
    });
  }

  onunload(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    if (this.nativeApplyTimer !== null) window.clearTimeout(this.nativeApplyTimer);
    for (const doc of Array.from(this.managedDocuments)) this.releaseDocument(doc);
    this.restoreAllNativeWindows();
    this.primaryDocument = null;
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as LegacySettings | null;
    const legacyTransparency = typeof saved?.transparency === "number"
      ? saved.transparency
      : typeof saved?.opacity === "number"
        ? 100 - saved.opacity
        : undefined;

    this.settings = {
      enabled: booleanSetting(saved?.enabled, DEFAULT_SETTINGS.enabled),
      interfaceTransparency: numberSetting(
        saved?.interfaceTransparency,
        legacyTransparency ?? DEFAULT_SETTINGS.interfaceTransparency,
        0,
        100,
      ),
      noteTransparency: numberSetting(
        saved?.noteTransparency,
        legacyTransparency ?? DEFAULT_SETTINGS.noteTransparency,
        0,
        100,
      ),
      radius: numberSetting(saved?.radius, DEFAULT_SETTINGS.radius, 0, 40),
      borderOpacity: numberSetting(
        saved?.borderOpacity,
        DEFAULT_SETTINGS.borderOpacity,
        0,
        100,
      ),
      shadowStrength: numberSetting(
        saved?.shadowStrength,
        DEFAULT_SETTINGS.shadowStrength,
        0,
        100,
      ),
      textHaloStrength: numberSetting(
        saved?.textHaloStrength,
        DEFAULT_SETTINGS.textHaloStrength,
        0,
        100,
      ),
      noteMaterial: booleanSetting(
        saved?.noteMaterial,
        booleanSetting(saved?.noteSheet, DEFAULT_SETTINGS.noteMaterial),
      ),
      nativeFogEnabled: booleanSetting(
        saved?.nativeFogEnabled,
        DEFAULT_SETTINGS.nativeFogEnabled,
      ),
      nativeFogRetention: numberSetting(
        saved?.nativeFogRetention,
        DEFAULT_SETTINGS.nativeFogRetention,
        0,
        100,
      ),
    };

    // Persist only the compositor-safe schema. Legacy blur, animation,
    // palette, tint, saturation and media-polish values are discarded.
    await this.saveData({ ...this.settings });
  }

  async saveSettings(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveData({ ...this.settings });
    this.refreshDocuments();
  }

  scheduleSettingsSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveData({ ...this.settings });
    }, 180);
  }

  scheduleNativeApply(): void {
    if (this.nativeApplyTimer !== null) window.clearTimeout(this.nativeApplyTimer);
    this.nativeApplyTimer = window.setTimeout(() => {
      this.nativeApplyTimer = null;
      this.refreshDocuments();
    }, 120);
  }

  manageDocument(doc: Document): void {
    if (!doc.body || !doc.defaultView || doc.defaultView.closed) return;
    this.managedDocuments.add(doc);
    this.applyToDocument(doc);
  }

  refreshDocuments(): void {
    const documents = new Set<Document>([document]);

    for (const doc of Array.from(this.managedDocuments)) {
      if (doc.defaultView && !doc.defaultView.closed) {
        documents.add(doc);
      } else {
        this.releaseDocument(doc);
      }
    }

    this.app.workspace.iterateAllLeaves((leaf) => {
      documents.add(leaf.view.containerEl.ownerDocument);
    });

    for (const doc of documents) this.manageDocument(doc);
  }

  private releaseDocument(doc: Document): void {
    this.clearDocument(doc);
    this.managedDocuments.delete(doc);
  }

  private applyToDocument(doc: Document): void {
    const { body, documentElement: root } = doc;
    if (!body) return;

    const settings = this.settings;
    const interfaceAlpha = 1 - settings.interfaceTransparency / 100;
    const noteAlpha = 1 - settings.noteTransparency / 100;
    const haloRatio = settings.textHaloStrength / 100;

    // Commit validated variables before enabling the material classes. A new
    // detached document therefore never sees transparent CSS with no alpha.
    root.style.setProperty("--lg-interface-alpha", interfaceAlpha.toFixed(3));
    root.style.setProperty("--lg-note-alpha", noteAlpha.toFixed(3));
    root.style.setProperty("--lg-radius", `${settings.radius}px`);
    root.style.setProperty("--lg-border-opacity", `${settings.borderOpacity / 100}`);
    root.style.setProperty("--lg-shadow-strength", `${settings.shadowStrength / 100}`);
    root.style.setProperty("--lg-text-halo-alpha", (haloRatio * 0.1).toFixed(3));
    root.style.setProperty(
      "--lg-text-halo-blur",
      `${(4 + haloRatio * 8).toFixed(1)}px`,
    );

    body.classList.remove(...REMOVED_CLASSES);
    delete body.dataset.liquidGlassPalette;
    body.classList.toggle(
      NOTE_MATERIAL_CLASS,
      settings.enabled && settings.noteMaterial,
    );
    body.classList.toggle(
      TEXT_HALO_CLASS,
      settings.enabled && settings.textHaloStrength > 0,
    );
    body.classList.toggle(ROOT_CLASS, settings.enabled);
    this.applyNativeFog(doc);
  }

  private clearDocument(doc: Document): void {
    this.restoreNativeDocument(doc);
    const { body, documentElement: root } = doc;
    if (body) {
      body.classList.remove(
        ROOT_CLASS,
        NOTE_MATERIAL_CLASS,
        TEXT_HALO_CLASS,
        ...REMOVED_CLASSES,
      );
      delete body.dataset.liquidGlassPalette;
    }
    for (const variable of CSS_VARIABLES) root.style.removeProperty(variable);

    // Remove variables used by every earlier prototype so disabling the
    // plugin is a complete CSS rollback, with no native cleanup required.
    for (const variable of [
      "--lg-interface-opacity",
      "--lg-note-opacity",
      "--lg-float-opacity",
      "--lg-float-blur",
      "--lg-opacity",
      "--lg-effective-blur",
      "--lg-saturation",
      "--lg-blur",
      "--lg-ambient-opacity",
      "--lg-tint-rgb",
      "--lg-tint-opacity",
      "--lg-pointer-x",
      "--lg-pointer-y",
    ]) root.style.removeProperty(variable);
  }

  private async toggleEnabled(): Promise<void> {
    this.settings.enabled = !this.settings.enabled;
    await this.saveSettings();

    if (this.settings.enabled && !document.body.classList.contains("is-translucent")) {
      new Notice("请先在 Obsidian 外观设置中开启“半透明窗口”");
      return;
    }
    new Notice(this.settings.enabled ? "Liquid Glass 已开启" : "Liquid Glass 已关闭");
  }

  async applyLiquidGlassPreset(): Promise<void> {
    this.restoreAllNativeWindows();
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
    new Notice("已恢复标准 Liquid Glass 材质");
  }

  async restoreNativeBenchmark(): Promise<void> {
    this.restoreAllNativeWindows();
    this.settings.nativeFogEnabled = false;
    this.settings.nativeFogRetention = 100;
    await this.saveSettings();
    new Notice("已恢复 v1.5.10 原生雾层；正文与界面设置保持不变");
  }

  private applyNativeFog(doc: Document): void {
    const hostWindow = doc.defaultView as NativeHostWindow | null;
    const bridge = hostWindow?.electronWindow;
    const isPrimaryDocument = doc === this.primaryDocument;
    const shouldApply = this.settings.enabled
      && this.settings.nativeFogEnabled
      && doc.body?.classList.contains("is-translucent");

    // Obsidian 1.13.4 opens Settings in an independent about:blank
    // BrowserWindow. That auxiliary window deliberately has no full-window
    // NSVisualEffectView. Native fog ownership is therefore restricted to the
    // plugin's primary workspace document; CSS can still be managed in every
    // document without turning one unsupported auxiliary window into a global
    // rollback of the working main window.
    if (!bridge || !isPrimaryDocument || !shouldApply) {
      if (bridge) this.restoreNativeBridge(bridge);
      return;
    }

    try {
      const addon = this.getNativeAddon(hostWindow);
      const handle = bridge.getNativeWindowHandle();
      const currentAlpha = addon.getAlpha(handle);
      if (!Number.isFinite(currentAlpha) || currentAlpha < 0 || currentAlpha > 1) {
        throw new Error(`主工作区原生玻璃层不可用：${addon.inspect(handle)}`);
      }

      const priorState = this.nativeWindows.get(bridge);
      const targetAlpha = this.settings.nativeFogRetention / 100;
      if (priorState && Math.abs(priorState.appliedAlpha - targetAlpha) < 0.001) return;

      const state: NativeWindowState = priorState ?? {
        appliedAlpha: currentAlpha,
        baselineAlpha: currentAlpha,
        document: doc,
      };
      this.withNativeSentinel(() => {
        if (!addon.setAlpha(handle, targetAlpha)) {
          throw new Error("原生玻璃层拒绝了透明度更新");
        }
      });
      state.appliedAlpha = targetAlpha;
      state.document = doc;
      this.nativeWindows.set(bridge, state);
      this.nativeErrorNotified = false;
    } catch (error) {
      this.settings.nativeFogEnabled = false;
      this.restoreAllNativeWindows();
      void this.saveData({ ...this.settings });
      if (!this.nativeErrorNotified) {
        this.nativeErrorNotified = true;
        const reason = error instanceof Error ? error.message : String(error);
        new Notice(`原生透景已安全停用：${reason}`);
      }
    }
  }

  private restoreNativeDocument(doc: Document): void {
    const bridge = (doc.defaultView as NativeHostWindow | null)?.electronWindow;
    if (bridge) this.restoreNativeBridge(bridge);
  }

  private restoreNativeBridge(bridge: NativeWindowBridge): void {
    const state = this.nativeWindows.get(bridge);
    if (!state) return;
    let restored = false;
    try {
      const hostWindow = state.document.defaultView as NativeHostWindow | null;
      if (!hostWindow || hostWindow.closed) {
        this.nativeWindows.delete(bridge);
        return;
      }
      const addon = this.getNativeAddon(hostWindow);
      const handle = bridge.getNativeWindowHandle();
      this.withNativeSentinel(() => {
        if (!addon.setAlpha(handle, state.baselineAlpha)) {
          throw new Error("无法恢复原生玻璃层");
        }
      });
      restored = true;
    } catch (error) {
      console.error("Liquid Glass native restore failed", error);
    }
    if (restored) {
      this.nativeWindows.delete(bridge);
    }
  }

  private restoreAllNativeWindows(): void {
    for (const bridge of Array.from(this.nativeWindows.keys())) {
      this.restoreNativeBridge(bridge);
    }
  }

  private getNativeAddon(hostWindow: NativeHostWindow): NativeVibrancyAddon {
    if (this.nativeAddon) return this.nativeAddon;
    const remote = hostWindow.electron?.remote;
    if (!remote) throw new Error("Obsidian 主进程桥接不可用");

    const runtime = remote.process;
    if (
      runtime.type !== "browser"
      || runtime.platform !== NATIVE_RUNTIME.platform
      || runtime.arch !== NATIVE_RUNTIME.arch
      || runtime.versions.electron !== NATIVE_RUNTIME.electron
      || apiVersion !== NATIVE_RUNTIME.obsidian
    ) {
      throw new Error(
        `运行时不匹配（需要 Obsidian ${NATIVE_RUNTIME.obsidian} / Electron ${NATIVE_RUNTIME.electron} / arm64）`,
      );
    }

    const paths = this.getNativePaths();
    const addon = remote.require(paths.addon) as NativeVibrancyAddon;
    if (
      !addon
      || typeof addon.processId !== "function"
      || typeof addon.getAlpha !== "function"
      || typeof addon.setAlpha !== "function"
      || addon.processId() !== runtime.pid
    ) {
      throw new Error("原生模块未运行在 Obsidian 主进程");
    }
    this.nativeAddon = addon;
    return addon;
  }

  private getNativePaths(): { addon: string; sentinel: string } {
    if (this.nativeAddonPath && this.nativeSentinelPath) {
      return { addon: this.nativeAddonPath, sentinel: this.nativeSentinelPath };
    }
    const adapter = this.app.vault.adapter;
    const pluginDir = this.manifest.dir;
    if (!(adapter instanceof FileSystemAdapter) || !pluginDir) {
      throw new Error("无法解析本地插件目录");
    }
    const absolutePluginDir = isAbsolute(pluginDir)
      ? pluginDir
      : join(adapter.getBasePath(), pluginDir);
    this.nativeAddonPath = join(absolutePluginDir, "vibrancy_alpha.node");
    this.nativeSentinelPath = join(absolutePluginDir, ".native-alpha-pending");
    return { addon: this.nativeAddonPath, sentinel: this.nativeSentinelPath };
  }

  private withNativeSentinel(callback: () => void): void {
    const { sentinel } = this.getNativePaths();
    writeFileSync(
      sentinel,
      JSON.stringify({ at: new Date().toISOString(), version: this.manifest.version }),
      "utf8",
    );
    try {
      callback();
    } finally {
      if (existsSync(sentinel)) unlinkSync(sentinel);
    }
  }

  private async recoverNativeCrashSentinel(): Promise<boolean> {
    try {
      const { sentinel } = this.getNativePaths();
      if (!existsSync(sentinel)) return false;
      unlinkSync(sentinel);
      this.settings.nativeFogEnabled = false;
      this.settings.nativeFogRetention = 100;
      await this.saveData({ ...this.settings });
      return true;
    } catch {
      return false;
    }
  }
}

class LiquidGlassSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: LiquidGlassPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const { settings } = this.plugin;
    this.plugin.manageDocument(containerEl.ownerDocument);
    containerEl.empty();
    containerEl.addClass("liquid-glass-settings");

    new Setting(containerEl)
      .setName("Liquid Glass")
      .setDesc("使用 Obsidian 的 macOS 原生半透明窗口作为唯一材质；基础模式保持 v1.5.10 的 Core-owned 架构。")
      .addToggle((toggle) =>
        toggle.setValue(settings.enabled).onChange(async (value) => {
          settings.enabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("唯一材质")
      .setDesc("请先在“外观”中开启“半透明窗口”。固定界面与正文背板仍沿用 v1.5.10 稳定路径。")
      .addButton((button) =>
        button.setButtonText("恢复标准材质").setCta().onClick(async () => {
          await this.plugin.applyLiquidGlassPreset();
          this.display();
        }),
      );

    new Setting(containerEl).setName("真实透景").setHeading();

    this.addSlider(
      "界面透光率",
      "独立控制固定界面区域；100% 不添加界面底色，0% 为不透明界面。不会改变正文透光率。",
      settings.interfaceTransparency,
      0,
      100,
      1,
      (value) => {
        settings.interfaceTransparency = value;
      },
    );

    this.addSlider(
      "正文透光率",
      "单独控制 Markdown 的固定视口背板；100% 完全透景，0% 为不透明正文。不会改变界面透光率。",
      settings.noteTransparency,
      0,
      100,
      1,
      (value) => {
        settings.noteTransparency = value;
      },
    );

    new Setting(containerEl)
      .setName("正文连续玻璃")
      .setDesc("开启后在固定视口上绘制一整块连续材质；不改 CodeMirror 或阅读模式的滚动层。")
      .addToggle((toggle) =>
        toggle.setValue(settings.noteMaterial).onChange(async (value) => {
          settings.noteMaterial = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("原生透景深化（本机）").setHeading();

    new Setting(containerEl)
      .setName("深化原生透景")
      .setDesc("只降低主工作区的 macOS 全窗原生雾层；设置与辅助窗口保持宿主背景，不改变文字、光标或正文滚动层。当前构建严格锁定本机 arm64 / Obsidian 1.13.4 / Electron 39.8.3。")
      .addToggle((toggle) =>
        toggle.setValue(settings.nativeFogEnabled).onChange(async (value) => {
          settings.nativeFogEnabled = value;
          if (value && settings.nativeFogRetention >= 100) {
            settings.nativeFogRetention = 65;
          }
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    this.addSlider(
      "系统雾层保留",
      "100% 等于 v1.5.10 标杆；数值越低，墙纸和后方软件越清楚。此项独立于界面/正文透光率，推荐先从 65% 开始。",
      settings.nativeFogRetention,
      0,
      100,
      1,
      (value) => {
        settings.nativeFogRetention = value;
      },
      "%",
      false,
    );

    new Setting(containerEl)
      .setName("安全回退")
      .setDesc("立即恢复 macOS 原生雾层到 v1.5.10；不改变你现有的界面、正文、圆角和文字柔化设置。")
      .addButton((button) =>
        button.setButtonText("恢复 v1.5.10").onClick(async () => {
          await this.plugin.restoreNativeBenchmark();
          this.display();
        }),
      );

    new Setting(containerEl).setName("保留的柔化效果").setHeading();

    this.addSlider(
      "文字周围柔化",
      "保留你喜欢的静态文字柔化；0% 完全关闭。当前稳定默认值为 0%，不在滚动或缩放时切换。",
      settings.textHaloStrength,
      0,
      100,
      2,
      (value) => {
        settings.textHaloStrength = value;
      },
    );

    new Setting(containerEl).setName("边缘与控件").setHeading();

    this.addSlider(
      "控件圆角",
      "只控制活动标签等固定控件；不改变正文窗格外形。",
      settings.radius,
      0,
      40,
      1,
      (value) => {
        settings.radius = value;
      },
      " px",
    );

    this.addSlider(
      "边缘高光",
      "控制固定控件的镜面边缘，不增加正文底色。",
      settings.borderOpacity,
      0,
      100,
      2,
      (value) => {
        settings.borderOpacity = value;
      },
    );

    this.addSlider(
      "阴影强度",
      "控制活动标签等固定控件的深度，不给正文滚动层增加滤镜。",
      settings.shadowStrength,
      0,
      100,
      2,
      (value) => {
        settings.shadowStrength = value;
      },
    );

    new Setting(containerEl)
      .setName("稳定渲染路径")
      .setDesc("CSS 浮层模糊、滚动补偿、动态取色与媒体特效已停用；真实模糊只由 macOS 原生材质提供。");
  }

  private addSlider(
    name: string,
    description: string,
    value: number,
    min: number,
    max: number,
    step: number,
    assign: (value: number) => void,
    suffix = "%",
    rendererRefresh = true,
  ): void {
    let valueLabel: HTMLElement;
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addExtraButton((button) => {
        valueLabel = button.extraSettingsEl;
        valueLabel.addClass("liquid-glass-value");
        valueLabel.setText(`${value}${suffix}`);
        button.setDisabled(true);
      })
      .addSlider((slider) =>
        slider
          .setLimits(min, max, step)
          .setValue(value)
          .onChange((nextValue) => {
            assign(nextValue);
            valueLabel.setText(`${nextValue}${suffix}`);
            if (rendererRefresh) {
              this.plugin.refreshDocuments();
            } else {
              this.plugin.scheduleNativeApply();
            }
            this.plugin.scheduleSettingsSave();
          }),
      );
  }
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberSetting(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback, min, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
