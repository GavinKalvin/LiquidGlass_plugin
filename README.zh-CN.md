# Liquid Glass for Obsidian

[English documentation](README.md)

一个只提供 **Liquid Glass** 的 macOS Obsidian 插件。`1.5.12` 完整保留 `1.5.10` 的稳定渲染路径，并为当前这台 Mac 增加一项受运行时锁定保护的“原生雾层保留”控制。

## 1.5.12 的深化透景

- `1.5.10` 的界面与正文透光率在 100% 时，插件色层已经是完全透明；剩余灰雾来自 macOS 的全窗 `NSVisualEffectView`；
- 新增“深化原生透景”和“系统雾层保留”设置，只调整原生玻璃背板，不改变 WebContents、文字、光标、CodeMirror 或阅读滚动层；
- 原生深化只作用于主工作区窗口。Obsidian 1.13.4 的独立设置/辅助窗口不具备同一种全窗原生玻璃层，因此明确跳过，不能再因设置页打开而关闭并回滚主窗口；
- 100% 原生雾层等于 `1.5.10` 标杆，数值越低，后方墙纸或软件越清楚；
- 原生调用只发生在启用、窗口创建、设置变更与恢复时，不监听 scroll、wheel 或 resize，也不轮询；
- 当前二进制严格锁定 `arm64 + Obsidian 1.13.4 + Electron 39.8.3`。运行时不匹配会 fail-safe 回到 `1.5.10`；
- 每次原生写入都有磁盘崩溃哨兵。若上次调用未正常返回，下次启动会自动关闭深化透景并恢复标杆；
- “恢复 v1.5.10”只恢复原生雾层，不会重置界面、正文、圆角或文字柔化参数。

## 保留的 1.5.10 核心修正

- 删除插件对 Electron `setBackgroundColor`、`setVibrancy` 的全部调用；
- 删除 50 ms 窗口发现、滚动补偿和 resize 状态机；
- 删除所有 CSS 浮层模糊、动态取色、媒体特效和滚动内容美化；
- 不再把 workspace、split、tabs、leaf、leaf-content、view-content 整条祖先链强制透明；
- 正文颜色只画在固定的 Markdown `.view-content` 外壳；
- 阅读模式只清除根 preview 的不透明背景，不选择嵌入笔记或嵌套预览；
- 不选择 `.cm-scroller`、`.cm-editor`、Markdown 虚拟化节点或尺寸计算层；
- 界面透光率与正文透光率不再叠乘；
- 设置、菜单和弹窗返回 Obsidian 的稳定宿主背景，首次打开设置使用 fail-opaque 启动帧；
- 保留用户明确要求的静态文字柔化，但默认值为 0%，且滚动时不更新任何样式；
- 状态栏保留高可读性固定背板，避免与滚到其下方的正文文字重叠。

## 材质结构

1. Obsidian 的“半透明窗口”设置创建并管理 macOS 原生透景；
2. 插件只清除 `.app-container` 的单一宿主色层；
3. 固定界面区域使用界面 alpha；
4. 固定 Markdown `.view-content` 使用正文 alpha；
5. CodeMirror 和阅读模式的实际滚动层只移动文字，不承载材质颜色。

## 设置

- 界面透光率：0–100%，只控制固定界面区域；
- 正文透光率：0–100%，只控制 Markdown 固定视口；
- 深化原生透景：启用当前机器专用的原生雾层深度控制；
- 系统雾层保留：0–100%，100% 等于 `1.5.10`，推荐先从 65% 开始；
- 正文连续玻璃：启用或停用独立正文材质；
- 文字周围柔化：保留静态 glyph halo，0% 完全关闭；
- 控件圆角、边缘高光、阴影：只用于固定控件。

使用前需在 **设置 → 外观** 中开启 **半透明窗口**。基础模式不会修改宿主原生材质；只有明确开启“深化原生透景”后，才会在受限运行时内调整已有原生玻璃背板的 alpha，并在停用或卸载时恢复其原值。

## 限制

普通 Obsidian 插件无法运行 Apple 私有的 Liquid Glass 几何折射着色器。本插件使用 macOS 原生窗口透景，因此可以真实显示墙纸或后方应用的扩散颜色，但不能复刻系统控件内部的私有动态折射。

## 安装

将 `manifest.json`、`main.js`、`styles.css` 和 `vibrancy_alpha.node` 放入：

```text
.obsidian/plugins/liquid-glass/
```

然后在 **设置 → 第三方插件** 启用 **Liquid Glass**。

## 从源码构建

```bash
pnpm install
pnpm run build
```

## License

MIT
