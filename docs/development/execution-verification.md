# Sites 与 NVIDIA：执行能力验证

2026-11-03（Asia/Hong_Kong）。下面的能力、证据和未知项不能互相替代。当前应用基线为 `0a73d94358fb61d6f414d218c977d54ac5719832`。

## 结论

| 项目 | 结果 | 能说明什么 |
| --- | --- | --- |
| Sites D1 / R2 | 已有线上验收通过 | 当前图库记录与文件可持久保存 |
| Sites HTTP / waitUntil | 文档确认有限的请求后台延续 | 不能保证长任务或故障恢复 |
| Sites 云端定时任务 | 官方 skill 和原生 create_schedule 确认提供 | 是给云端 Agent 的定时更新指令，不是已验证的应用 job queue |
| Sites 自定义 Queue / Cron / Workflow | 当前受支持工具与配置中没有确认入口 | 此路线未通过实施门槛；不推断平台内部永久不支持 |
| Sites 无用户服务访问 | 实际携带返回的 service access 凭证访问 /api/me，应用返回 401 | 平台通行凭证不能替代图库 owner 身份，现有鉴权未被绕过 |
| NVIDIA GET /v1/models | 多次真实请求 HTTP 200、85 个 model ID | 有可用的目录刷新接口，但目录不是可调用性证明 |
| NVIDIA 图像理解 | 两张项目示例 HTTP 200、结构合法的中文标签 | 当前账户下有实际可用的免费视觉模型端点 |
| NVIDIA 刷新后复用 | 两次探针刷新目录后均复用此前已成功的同一模型 | 验证选择策略可行，网站本身尚未实现 |
| NVIDIA 202 回执查询 | 仅有官方文档，当前成功调用均同步 200 | 未验证 pending/查询协议，不自动套用其他端点的 status URL |
| NVIDIA Style Lab 图像编辑 | 没有成功的自有图片编辑验证 | 不能把视觉模型的文字输出当成已接通生图 |

**总体门槛未通过：后台执行方式尚未落实。**因此不在生产启用 Jobs/Runner、自动分类或新增生产密钥配置，不向用户展示会永久排队的功能。用户接受独立执行器后，已开始 Task 1 本地代码与离线测试；它们不是已通过的云端验收。

## Sites：核对了什么

1. 已安装官方 Sites skill 1.1.2：SKILL.md、references/storage.md、identity-and-secrets.md、recurring-updates.md、site-mcp-server.md。
2. 本项目 `.openai/hosting.json` 只声明 `DB` / `BUCKET`；当前 `worker/index.ts` 只有 fetch handler。
3. 官方支持的 hosted worker 能力、原生 Sites 工具及 starter/build 配置；未发现可为这个 Sites 项目创建或绑定 Queues、Cron、Workflows 的受支持操作。Cloudflare 本身提供这些产品不代表 Sites 已开放同样的配置。
4. `get_site`：当前 `custom`、仅 owner，关联 automations 为空。没有为验证创建持续运行的 Agent 自动化，没有扩大访问范围。
5. 服务访问实际检查：由 get_site 返回的既有 service access token，只发送到同一个 Site 的 `/api/me`；HTTP 401，`Sign in to open your library.`，没有 user。凭证未写入源码、命令参数、结果文件或输出。

### 定时更新与任务执行不是同一份承诺

官方 recurring-updates 流程支持发布后配置云端 Agent 定时更新，并要求先验证无人值守 writer 的授权和写入/readback。create_schedule 接收自然语言 prompt、VEVENT 与时区，不是原生 Worker queue message 的提交/ack/retry 接口。

我们没有拿到执行时延、自动重试、租约恢复或每次上传触发的可靠交付合同，也没有以真实云任务完成 writer/readback。因此不把“存在此工具”或“automation 数组为空”写成后台验收通过。

Cloudflare 文档确认 HTTP Worker 的 waitUntil 在响应结束或断连后最多延续 30 秒。它适合有限收尾工作，不能保证本项目的持久 AI 任务。D1 中插入 jobs 行也不会自行执行。[Cloudflare context 文档](https://developers.cloudflare.com/workers/runtime-apis/context/)

### 下一步需要的具体选择

建议若要继续完整的无人值守 AI：同 repo 增加用户自己 Cloudflare 账户下的一个小型托管执行器，先验证可靠定时/投递、服务端认证和关闭网页后的执行；Sites 继续提供页面与 D1/R2，执行器只经受限任务接口访问数据，不复制整份图库。

用户于本轮明确接受这一部署扩展；实际账户登录、部署与无人值守验收仍未完成，见 [实施计划](cloudflare-executor-plan.md)。需要用户账户配置，并核对实际额度与成本；不能假设 Sites 管理的存储能直接跨账户绑定。Cloudflare Queues 文档提供可靠投递相关能力与免费/付费配额，但它们是独立账户产品，不等于当前 Site 的已配置资源。[Queues 产品计费与边界](https://developers.cloudflare.com/queues/platform/pricing/)

另一选择是暂时保持 Sites-only、继续人工图库，明确不启用无人值守 AI。两条路线不同时实现，也不引入云端 Agent 加循环请求作为隐蔽备用通道。

## NVIDIA：真实调用

使用当前进程已有的 `NVIDIA_API_KEY`；只上传项目公开示例 `public/photos/1060.jpg`、`1067.jpg`，没有个人照片。Key 未写入 repo、截图或输出，也没有自动配置进 Sites。

### 目录刷新

真实请求：`GET https://integrate.api.nvidia.com/v1/models`，Bearer 认证。多次返回 HTTP 200、85 个模型。两次可复现探针对排序后的 ID 列表计算出的 SHA-256 相同：

`9853a07a3edf36fc7a6e418bf236de4f08958459dde9e8d2e46b0fddd97eb50f`

目录不提供足以证明“支持图像、当前 key 可调用、当前健康”的完整契约。目标策略仍须将目录与小份明确的能力/协议配置取交集，并记录最近真实成功；不以模型名字猜能力，不扫描所有模型逐个发图。

### 实际失败，必须保留

- `meta/llama-3.2-11b-vision-instruct`：目录中有，按官方 unified chat 示例调用返回 HTTP 404，错误为 upstream function not found。
- `google/gemma-3-4b-it`：目录中有，调用 HTTP 404。
- `nvidia/nemotron-3.5-super-vl-120b-a12b` 首次用 max_tokens=256、未显式关闭 thinking，HTTP 200 但最终 content=null。HTTP 成功不等于任务成功。
- 后续同时改为 max_tokens=512 与 `chat_template_kwargs.enable_thinking=false` 后得到有效输出。这是可用配置，不是对某一个参数的单独因果证明。

上述 404 说明必须按实际调用判定；不能从一次结果证明模型对所有账户永久下线。

### 已通过的模型与配置

端点：`POST https://integrate.api.nvidia.com/v1/chat/completions`

模型：`nvidia/nemotron-3.5-super-vl-120b-a12b`

配置：`stream=false`、`temperature=0`、`max_tokens=512`、`chat_template_kwargs.enable_thinking=false`。图片通过 `image_url` 内容块中的 JPEG base64 输入。提示词要求只描述可见内容，返回有界 JSON，不猜身份与地点。

| 示例 | 探针时间（UTC） | HTTP | 观察耗时 | 输出 |
| --- | --- | --- | --- | --- |
| coffee / 1060.jpg | 2026-11-03T05:56:37Z | 200 | 908 ms | 咖啡、滴滤、手冲；手冲咖啡滴滤过程 |
| city / 1067.jpg | 2026-11-03T05:55:24Z | 200 | 987 ms | 摩天大楼、城市天际线、日落；城市高楼林立，夕阳余晖洒满天际。 |

这些是小样本的观察值，不是性能 SLA、准确率评测或大规模额度验证。两次先刷新目录，再选择/复用此前成功的同一模型；网站还没有这些生产逻辑。

[脱敏原始观察记录](evidence/2026-11-03-nvidia.json)保留模型、状态、配置、示例 hash、输出、requestId 和耗时，不保留图片 base64、key、推理内容或上游内部账户标识。

### 尚未通过的调用路径

- 当前调用没有触发 202；选定模型的 requestId 回查、结果保留期限、轮询限流仍需验证。
- 官方不同模型的 status 地址存在差别，不能跨端点复制 URL。
- 未验证生产 Sites → NVIDIA 的连通性、配额、429/5xx 实际恢复；未在生产写入 key。
- 未验证支持用户图片输入的免费图像编辑端点；Style Lab 仍是预生成示例。

官方来源：[Nemotron 的免费端点和图片调用示例](https://build.nvidia.com/nvidia/nemotron-3.5-super-vl-120b-a12b)、[Llama Vision 官方调用示例](https://build.nvidia.com/meta/llama-3.2-11b-vision-instruct)、[NVIDIA vision 接口的 202 说明](https://docs.api.nvidia.com/nim/reference/meta-llama-3_2-11b-vision-instruct-infer)。文档与当次实测不一致的地方以上述记录说明，不用文档替代实测。

## 对架构的修正

保留 HTTP / Library / Jobs / Adapter 边界；后续 Task 1 本地骨架增加任务接口，但当前线上图库业务仍未改变。补充以下明确约束：

- 模型目录与实际成功分开；刷新只更新后续任务的候选，不改在途任务。
- 空内容或结构无效必须失败，不能因 HTTP 200 标成 succeeded。
- 只有确认实际端点可恢复，才启用 pending receipt；否则超时是结果未知，不盲目重发生成请求。
- 可靠唤醒未配置时不接受后台任务。它是实施前置条件，不是上线后 TODO。
