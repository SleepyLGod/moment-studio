# Development

- [HEIC、拍摄时间、方向与验收](heic-import.md)
- [自有照片 AI 改图服务：免费优先核实](ai-image-edit-services.md)

- [目标架构与接口约束](architecture.md)：基本确认的模块化单体设计；新增能力不等于已实现。
- [系统架构图](diagrams/architecture.svg) · [HTTP / 内部接口图](diagrams/interfaces.svg)
- [交互版架构文档](architecture-review.html)：下载后用浏览器打开；不依赖运行网站。
- [Sites / NVIDIA 执行能力验证](execution-verification.md)：文档证据、真实调用、失败与未验证项分开记录。
- [当前已实现的 Sites 云图库](../sites-native-design.md) · [已有云端验收](../cloud-validation.md)
- [独立执行器云端验收与当前接口图](cloud-executor-validation.md)：实际 Cron、关闭页面后的完成、原图校验和剩余验证范围。
- [模型刷新、月份与近期分组](models-and-organization.md)：本轮实际规则、接口和验证范围；自动分组不写人工相册。

图的可编辑源文件在 `diagrams/*.json`，由 Archify 2.8 生成 SVG；SVG 和交互 HTML 已随文档保存。修改图时同步更新源文件与输出，不必给应用安装 Archify。参考思想与来源见架构文档末尾。

## 当前实施门槛

2026-11-03：NVIDIA 已配置到 Sites 生产环境。同 repo 的 own-account Cloudflare Cron 执行器已上线；关闭全部图库页后，咖啡示例经实际 scheduled 事件完成识图并保存 D1。重新打开可读标签，原图下载 hash 一致。云端重叠调用只领取一次；租约过期/旧执行者保护仅通过本地测试，尚未云端故障注入。

Sites 自身仍没有已确认的低层 Cron/Queue/Workflow 配置入口；外部执行器只负责定时唤醒，D1 仍是唯一任务状态源。每次处理上限为一张，不用浏览器轮询承担执行。本轮已实现模型目录刷新/最近成功偏好、月份视图和派生近期分组，验证范围见[功能文档](models-and-organization.md)。

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

- [Cloudflare Style Lab](cloudflare-style-edit.md): free-only image edit profile, task lifecycle and actual usage evidence.

- [大图、原图比例、NVIDIA完整目录与ChatGPT订阅接入复核](model-capabilities-and-resolution.md)：尺寸实测、NVIDIA目录，以及外部OAuth与原生Codex订阅能力的区别。

- [回收站、显式输出尺寸与较早订阅验证](trash-output-and-subscription.md)：恢复边界、Original/Custom，以及后续云端验收的链接；原本机执行端设想保留作历史。

- [OpenAI subscription cloud round-trip proof](openai-cloud-proof.md): isolated public sample, Site MCP boundary, acceptance criteria and historical explicit task start.

- [Website-triggered OpenAI cloud proof](openai-event-trigger.md): signed MCP Events, corrected callback transport and passed hosted click-to-result acceptance (82 local tests plus independent cloud/download checks).

- [Style Lab subscription editing](style-lab-subscription.md): owner-selected inputs, saved recipes, job delivery and automatic listener renewal.
