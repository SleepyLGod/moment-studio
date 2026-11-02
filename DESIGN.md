# 片刻界面

本轮是既有应用中风格 Lab 的扩展，视觉依据为用户认可的 outputs/prompt-style-lab/concept.png。图库、拼图和顶部三个入口保持既有布局。

风格 Lab 的核心问题：这张照片可以变成什么，以及如何把创作描述存为可复用的 Style？最大区域是可拖动原片/结果对照；下面是创作描述、保留构图和保存动作，再下面为 Style 列表。参考图和基础调色收在次级展开项中。

深绿炭色背景、骨白文字、单一浅橄榄金主按钮。无装饰渐变或发光。系统中文字体用于操作界面，照片保持主体。桌面两侧留白，手机上下叠放并保留 44px 操作目标。

与设计稿的有意差别：主按钮写“预览示例”；结果标“预生成示例”。增加照片切换条和复用入口以完成可点击流程。未匹配示例的自定义描述显示待生成，不能借用其他配方结果。

Taste 的 app-screen 原则用于内容优先、层级与手机检查；保留已批准的配色和布局，不重新抽签改变方向。Impeccable 用于整体流程与细节审查。浏览器验证统一使用 CUA。

## English Lab type study — 2026-11-02

User requested less explanatory copy and an English trial using Case3y/Sleet Mono. Lab and top navigation use a self-hosted Sleet Mono regular font, with PingFang for retained Chinese user content. The font file and MIT license are in public/fonts. This is a Lab pilot, not complete application localization.

Removed persistent duplicate demo notes, photo-name caption and per-card built-in labels. A single Demo information control explains pre-generated examples. Photo selection uses thumbnails; saving uses a named bookmark control. Custom-input pending state stays visible. Original Chinese recipes and their English equivalents share a canonical signature, preserving old saved recipes and duplicate detection. Existing user names and prompts are not translated or rewritten.


## Shared English workbench — 2026-11-02

The user approved PingFang / Source Han Sans for Chinese and requested the English Lab treatment throughout. All application controls and dialogs now use English, self-hosted Sleet Mono, and the same control/type scale. Chinese user content falls back to PingFang SC / Source Han Sans SC without rewriting stored names, notes or recipes. Internal category identifiers are preserved.

Library remains image-first. Collage layouts use Lucide layout icons with accessible names/tooltips; shuffle and album-order/remove controls use icons. Optional album notes are collapsed. Grouping tabs say By tags / Manual so the grouping mechanism does not need a paragraph. Format/size limits, errors and the Demo information entry remain explicit. Stale toasts clear when opening another dialog. Very narrow filter rows wrap rather than overflow.
