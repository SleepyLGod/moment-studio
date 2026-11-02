# 一个 repo：Sites、Pages 与 Go

同一个 `moment-studio` repo 保存前端与后续 Go 业务代码。Sites 和 GitHub Pages 使用同一套界面：Pages 是示例数据模式，Sites 是计划接入真实图库的入口。Go 是唯一的图库业务服务，部署位置可独立选择。

## 当前状态

| 部分 | 用途 | 已实现状态 |
| --- | --- | --- |
| moment-studio 私有仓库 | 源码、修改历史与构建检查 | 已有仓库；本地文档修改不等于已推送 |
| Sites | 工作台入口 | 保持所有者私有；线上源代码版本以 Sites 部署记录为准 |
| GitHub Pages | 同一前端的示例模式 | 尚未配置或发布 |
| Go、数据库与对象存储 | 真实图库业务和持久化 | 架构草案阶段，尚未实现或部署 |

用户已确认 PostgreSQL，第一阶段交付 Sites＋云端 Go＋云数据库＋对象存储的完整流程。本地／Docker 用于开发、测试和后续自托管，不作为云端交付前的独立产品阶段。

现有 Sites project_id 保留在 `.openai/hosting.json`，当前配置仅为静态 `dist/`。

现有地址：<https://moment-studio-sleepylgod-demo.von-lu-cuhk.chatgpt.site>。访问限制保持不变。源码提交或推送不会自动更新这个地址。

## Pages 示例模式

计划从本仓库构建 Pages 项目页，示例路径为 `https://sleepylgod.github.io/moment-studio/`。这只是预期地址，目前未发布；现有个人主页保留。

Pages 使用同一套图库、拼图和 Style Lab 界面及示例素材，不接生产图库或生产写接口。发布前需处理项目子路径下的图片和字体地址，并确认当前 GitHub 套餐支持从此私有仓库发布 Pages。若权限不足，先报告限制，不另建第二个仓库。

## 计划中的 Go 部署

| 模式 | 路径 | 要求 |
| --- | --- | --- |
| 本地／Docker | 本地前端 → Go → PostgreSQL／照片持久目录 | 本机访问；本地开发身份不得用于公网 |
| 纯云端 | Sites → 云端 Go → PostgreSQL／自有对象存储 | 独立主机与正式鉴权，电脑关机后仍可用 |
| 自己账户的 Cloudflare Containers | Sites → Cloudflare 容器入口 → Go | 需 Workers Paid 和单独配置；数据库与照片不能依赖临时磁盘 |
| Sites + 本机 Go | Sites → 可达且鉴权的 HTTPS 地址 → 本机 Go | 需要额外网络接入；不能直接访问用户电脑的 localhost，电脑离线即不可用 |

Cloudflare Containers 与 Sites 管理的 Workers 环境是两个部署边界。目前没有已确认的流程把 Go 容器直接部署进现有 Site。

具体职责、身份传递、数据恢复与实施顺序见 [Sites + Go 设计草案](docs/superpowers/specs/2026-11-02-sites-go-gallery-design.md)。

## 数据状态

当前照片、相册和 Style 仍在浏览器 IndexedDB；不同网址不会自动同步。规划中的 Go 接口将使用按资源的持久化操作，不直接将整个前端 state JSON 当成云图库。

本仓库不存放真实照片、图库备份或服务密钥。原图、缩略图、衍生图、数据库备份和代码版本需要各自的持久化与恢复流程。
