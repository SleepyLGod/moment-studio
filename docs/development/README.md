# Development

- [目标架构与接口约束](architecture.md)：基本确认的模块化单体设计；新增能力不等于已实现。
- [系统架构图](diagrams/architecture.svg) · [HTTP / 内部接口图](diagrams/interfaces.svg)
- [交互版架构文档](architecture-review.html)：下载后用浏览器打开；不依赖运行网站。
- [Sites / NVIDIA 执行能力验证](execution-verification.md)：文档证据、真实调用、失败与未验证项分开记录。
- [当前已实现的 Sites 云图库](../sites-native-design.md) · [已有云端验收](../cloud-validation.md)

图的可编辑源文件在 `diagrams/*.json`，由 Archify 2.8 生成 SVG；SVG 和交互 HTML 已随文档保存。修改图时同步更新源文件与输出，不必给应用安装 Archify。参考思想与来源见架构文档末尾。

## 当前实施门槛

2026-11-03：NVIDIA 目录刷新、选定模型的自有示例图片输入、中文结构化输出与刷新后复用模型已做本地真实 API 验证。NVIDIA 尚未配置到 Sites 生产环境。

当前 Sites 工具/指导提供云端 Agent 定时更新，但没有确认可配置低层可靠队列、Cron 或 Workflows。关闭所有网页后的持续执行与中断恢复尚未通过云端验证，因此新增 AI 后台实施未开始。用户对额外执行通道的选择应记录后再继续；不能用浏览器轮询或短期 waitUntil 冒充持久后台。

## 复现 NVIDIA 验证

使用 Node.js 24+；在进程环境中提供 `NVIDIA_API_KEY`，不要把 key 写进命令参数、文档或提交。

```sh
# 只刷新目录，不执行识图
node scripts/verify-nvidia.mjs

# 明确执行一次真实调用，仅允许项目自带 coffee / city 示例
node scripts/verify-nvidia.mjs --infer --sample coffee --preferred nvidia/nemotron-3.5-super-vl-120b-a12b
node scripts/verify-nvidia.mjs --infer --sample city --preferred nvidia/nemotron-3.5-super-vl-120b-a12b
```

`--out PATH` 可保存脱敏结果。探针默认只访问目录；识图必须明确传 `--infer`，不在 CI 自动调用服务。返回 HTTP 200 但内容为空、JSON 不合法或结构不符仍视为失败。不会自动换模型重试、抓取网页、调用付费备用服务或发送真实图库。
