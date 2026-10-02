# Liquid Glass for Obsidian

[English documentation](README.md)

一个只提供 **Liquid Glass** 的 macOS Obsidian 插件。`1.5.21` 修复滑块左侧数值重叠，保留 `1.5.20` 的透景方向修正、可回退原生材质增强档，以及 EPUB、Current Note AI 和 Gallery Explorer 兼容。

## 1.5.21 的滑块 UI 修复

- Obsidian 1.13+ 统一使用系统自带的数值标签，移除重复的图标按钮标签；
- `150 / 150` 保持单行、自适应宽度，旧版 Obsidian 只使用一个普通文字标签；
- 不改变透景参数、原生材质逻辑或 EPUB/Gallery 的媒体显示。

## 1.5.20 的方向修正与增强透景

- 原生透景强度为 0–150：0 最弱，150 恢复完整原生透景，等同于上一版的 0；
- 上一版降低的是整块原生视图的 alpha，不是雾层独立透明度。本机实际反馈显示，它会把背景透景一起淡出，所以方向已反转；
- 旧设置自动换算为 `150 − 旧值`，并保存方向版本标记；以后重新加载不会重复反转；
- 新增“增强透景材质（实验）”：在已有玻璃层上改用 macOS under-window 材质，尝试更通透的背板；外观由系统主题决定，关闭即可恢复原材质；
- 推荐强度 150 配合增强材质；不会调整文字、光标或图片元素的 opacity，不添加第二块玻璃、私有滤镜或滚动监听；
- 增加 Obsidian 1.13.7 / Electron 39.8.3 / macOS arm64 的精确版本档，仍保留主进程、唯一全窗玻璃层和崩溃恢复检查；
- 本机应用归档确认了版本与 sidebar 原生材质路径；运行中的原生层结构由插件加载时检查，实际视觉效果需重新加载插件后确认。

## 1.5.17 的 Current Note AI 兼容

- 只在 Liquid Glass 已启用、Obsidian 半透明窗口已开启、非全屏且 Current Note AI 位于右侧栏时生效；
- 清除 Current Note AI 根视图的不透明背景，复用右侧栏已有的单一原生材质；
- history、context、proposal 和 assistant 气泡使用轻量静态 tint，composer 使用较强但仍透明的输入底板；
- operation 与 textarea 保持透明，避免嵌套 alpha 叠加；用户气泡保留高对比 accent，diff 只保留透明红绿语义色；
- 不新增 `filter`、`backdrop-filter`、元素 `opacity`、轮询、动画或原生模块改动；
- 关闭 Liquid Glass、关闭半透明窗口、进入全屏或将视图移出右侧栏后，自动恢复 Current Note AI 原始样式。

## 1.5.16 的 EPUB 兼容

明确适配的是 [EPUB Reader and Highlighter v0.2.1](https://github.com/okkio-31mon/epub-reader-highlighter)，感谢插件作者 [@okkio-31mon](https://github.com/okkio-31mon)。本项目提供的是该阅读器的液态玻璃兼容层，不是修改其 EPUB 插件本身。

- EPUB 顶部控制栏使用“界面透光率”，滚动/分页切换器使用稳定的半透明控件填充；
- EPUB 正文使用与 Markdown 相同的“正文透光率”和“正文连续玻璃”开关；
- 材质只画在 Obsidian 的固定 EPUB 视口，并保留阅读器所选灰、米、护眼绿、深色或自定义背景作为 tint；
- iframe 内只清除 `html` 和 `body` 背景；接近全透明时，文字色与光晕只作用于不含媒体的语义正文块，含图片、SVG、音视频、canvas、嵌入对象、嵌套 frame 或 MathML 的块保持原有继承链；
- 换章、分页/滚动切换、主题切换和多窗格由事件驱动的局部观察器处理，不监听书籍文字、scroll、wheel 或 resize；
- 关闭、窗口关闭或插件卸载时，会移除注入样式、标记、事件和观察器。

## 原生透景的正确控制方向

- 界面与正文透光率在 100% 时，插件色层已经是完全透明；之后的背景外观由 macOS 的全窗 `NSVisualEffectView` 决定；
- “深化原生透景”只调整主窗口的原生玻璃背板，不改变 WebContents、文字、光标、CodeMirror 或阅读滚动层；
- 原生深化只作用于主工作区窗口。Obsidian 1.13.4 的独立设置/辅助窗口不具备同一种全窗原生玻璃层，因此明确跳过，不能再因设置页打开而关闭并回滚主窗口；
- 150 对应首次捕获的完整原生玻璃，0 对应最弱的原生透景贡献；数值越高，原生背景透景贡献越强；
- 加深透景通过单独的增强材质开关尝试实现，不再靠继续衰减整块原生透景层；
- 旧版“雾层保留”数值会自动换算为视觉等效的新“透景强度”，避免更新时突然跳变；
- 映射以宿主基线为参照，不再假定系统原始 alpha 必然等于 1；
- 原生调用只发生在启用、窗口创建、设置变更与恢复时，不监听 scroll、wheel 或 resize，也不轮询；
- 当前二进制严格锁定 `arm64 + Obsidian 1.13.4 或 1.13.7 + Electron 39.8.3`。运行时不匹配会 fail-safe 回到 `1.5.10`；
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
4. EPUB 固定控制栏同样使用界面 alpha；
5. 固定 Markdown `.view-content` 使用正文 alpha；
6. Current Note AI 右侧栏清除不透明根背景，并用静态界面 tint 保持卡片与输入区层级；
7. 兼容的 EPUB 固定视口使用相同 alpha 与 EPUB 主题 tint；
8. CodeMirror 和阅读模式的实际滚动层只移动文字，不承载材质颜色。

## 设置

- 界面透光率：0–100%，只控制固定界面区域；
- 正文透光率：0–100%，控制 Markdown 与兼容 EPUB 的固定视口；
- 深化原生透景：启用当前机器专用的原生雾层深度控制；
- 原生透景强度：0–150；0 最弱，150 为完整原生透景，相当于上一版的 0；
- 增强透景材质（实验）：改用 macOS under-window 背板，关闭后恢复原材质；
- 正文连续玻璃：启用或停用独立正文材质；
- 文字周围柔化：保留静态 glyph halo，0% 完全关闭；
- 控件圆角、边缘高光、阴影：只用于固定控件。

使用前需在 **设置 → 外观** 中开启 **半透明窗口**。基础模式不会修改宿主原生材质；只有明确开启“深化原生透景”后，才会在受限运行时内调整已有原生玻璃背板的 alpha，并在停用或卸载时恢复其原值。

## 限制

普通 Obsidian 插件无法运行 Apple 私有的 Liquid Glass 几何折射着色器。本插件使用 macOS 原生窗口透景，因此可以真实显示墙纸或后方应用的扩散颜色，但不能复刻系统控件内部的私有动态折射。

## 安装

将 `manifest.json`、`main.js`、`styles.css` 和 `vibrancy_material.node` 放入：

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
