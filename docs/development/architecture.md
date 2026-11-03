# moment：图库与 AI 的架构提案

2026-11-03 · 目标架构基本确认；新增 AI 功能须先通过平台验证。

更新：Jobs/Runner、单一 NVIDIA 识图适配器及 own-account Cron 唤醒已部署并完成关闭网页验收，见[当前部署与接口图](cloud-executor-validation.md)。下文和原有 SVG 保留完整目标设计，月份视图、自动分组、动态选模与图像编辑部分仍待实现；不能将目标接口误当作现有 API。

当前已实现的云图库见 [Sites 原生设计](../sites-native-design.md)；最新验证结论见 [执行能力验证](execution-verification.md)。本文件描述目标接口，不代表全部已经实现。

## 结论

保留一个仓库、一个 Sites 应用、一个 D1 和一个 R2。把现有 API 中混在一起的职责整理成 HTTP、Library、Jobs、NVIDIA Adapter 四个边界；Runner 是 Jobs 的执行部分，不另起一个业务服务。可靠后台唤醒机制必须在实现 AI 前验证，不能靠数据库中有一条任务记录就声称关闭网页后会继续。

## 从需求反推边界

| 事实 | 设计决定 |
| --- | --- |
| 原图昂贵且必须保住 | File 记录与 Photo 信息分开，原始字节不可覆盖 |
| 相册只是组织照片 | 保存照片 ID 和顺序，不复制文件 |
| 标签、分组会变化 | 分析结果与人工决定分开，AI 不能改相册成员 |
| 模型目录、额度、协议会变化 | 选模和供应商协议都放在 Adapter，前端不拼供应商请求 |
| AI 比普通请求慢，还会中断 | 任务与网页请求分开，任务状态持久化 |
| 只有私人图库，不需要多团队系统 | owner 身份与归属检查保留，不预建 RBAC、事件总线或微服务 |

## 图例与部署事实

[系统架构图](diagrams/architecture.svg)是逻辑组件图；[接口图](diagrams/interfaces.svg)是 HTTP 接口与内部模块的对应关系。可打开 [交互版本](architecture-review.html)。标注“已有”的 Sites / D1 / R2 已接通；Jobs、Runner、Adapter 是提案。图中的同一 Worker 是代码组织目标，不是声称 Sites 已经配置可靠后台触发。

当前 worker/index.ts 只有 fetch 入口；.openai/hosting.json 只声明 DB、BUCKET。现有 Sites 指引确认这两个存储绑定，没有提供足够证据证明当前项目可配置 Queues、Cron 或 Workflows。Cloudflare 产品支持这些能力，不代表 Sites 已向本项目开放。

## 组件职责

| 层 / 模块 | 负责 | 不负责 |
| --- | --- | --- |
| Web UI | 选择照片、相册排序、编辑参数、提交任务、读取状态 | API key、供应商选择、后台任务调度 |
| HTTP | Sites 身份转换为 Actor，校验输入/归属/修订号，输出稳定 JSON | 图像推理、相册组织算法 |
| Library | 月份查询、人工标签、相册规则、分析结果应用、创作保存 | NVIDIA 协议、重试和模型目录 |
| Jobs + Runner | 创建与去重、领取任务、执行步骤、持久状态、提交结果 | 自行判断标签含义，绕过 Library 修改相册 |
| NVIDIA Adapter | 候选目录、能力筛选、偏好选模、协议转换、响应验证 | 写图库、创建正式相册、决定文件保留期 |
| D1 / R2 | D1 记录与索引；R2 文件字节 | 图片写进数据库、数据库当图像缓存 |

模块用普通 TypeScript 函数连接，不用内部 HTTP，也不做 service/repository/factory 的多层转发。只在真实变化边界定义小接口：AI 模型和后台唤醒。D1、R2 今天只有一种实现，直接封装实际需要的操作，不造通用存储框架。

## 对外 HTTP 接口

现有路径保留。下表中的新增行为均待实现，不能当作当前接口文档使用。

| 状态 | 接口 | 契约 |
| --- | --- | --- |
| 已有 | POST /api/uploads → PUT /:id/body → POST /:id/complete | 上传会话，只确认完整文件；完成文件不等于已有 Photo |
| 已有 | GET /api/files/:id | 身份与归属检查后读取，objectKey 不暴露 |
| 扩展 | GET /api/photos?month=2026-11&tag=海边&cursor=... | 有上限的游标分页，日期来源可辨别 |
| 扩展 | PUT /api/photos/:id | 保留修订号检查；可改人工信息，原图不可替换 |
| 已有 | GET /api/albums；PUT /api/albums/:id | 人工相册：有序 photoIds、标题、说明、revision |
| 扩展 | GET /api/styles；PUT /api/styles/:id | 保存配方；任务开始时冻结配方，不跟随之后修改 |
| 新增 | POST /api/ai/models/refresh | 页面刷新时调用；返回候选、能力、检查时间、选择依据 |
| 新增 | POST /api/jobs | 创建 analyze / group / generate 任务，返回 202 + jobIds |
| 新增 | GET /api/jobs?ids=... | 只读进度与结果，读取不能承担执行职责 |
| 新增 | GET /api/groups?from=...&to=... | 最近时段的自动分组，不自动变成人工相册 |
| 新增 | POST /api/creations | 将任务中的临时成果正式保存到 photos，必须是自己的任务 |

所有照片/文件/相册 ID 都要在服务端验证归属。ownerId 来自 Sites 身份，不能采信浏览器提交的 ownerId。后台以已验证任务的 ownerId 构造受限执行上下文；触发入口需要服务端认证，不公开 run-job 按钮或匿名执行 API。

POST /jobs 用可判别输入，不用 task:string + 任意 JSON：

```ts
type CreateJobs =
  | { kind: 'analyze'; photoIds: string[] }
  | { kind: 'group'; photoIds: string[]; prompt?: string }
  | { kind: 'generate'; photoIds: string[]; styleId: string; styleRevision: number };
```

第一版每批最多 20 张；analyze / generate 每张一条任务，group 每组一条。服务端冻结照片输入版本、分组成员、Style 配方和模型选择；返回 jobIds，客户端按 ID 读取。不给用户无限 JSON 或任意供应商 URL。尚未接通的 generate 能力应返回明确错误，不能接受后永久 queued。

## 内部接口：只抽象实际会变化的地方

以下为接口形状示意，非已实现 TypeScript 包。

```ts
type Capability = 'analyze' | 'editImage';

type ModelChoice = {
  provider: 'nvidia';
  modelId: string;
  capability: Capability;
  adapterRevision: string;
};

type StepResult<T> =
  | { state: 'complete'; value: T; requestId?: string }
  | { state: 'pending'; receipt: ProviderReceipt; nextCheckAt: string };

// 只有确认端点可恢复时才使用 receipt；不伪造可查询能力。
type ProviderReceipt = {
  provider: 'nvidia';
  modelId: string;
  requestId: string;
  endpointKey: string; // 服务端枚举配置，不是任意回调 URL
};

interface VisionModel {
  analyze(input: AnalysisInput, model: ModelChoice): Promise<StepResult<Analysis>>;
}

// 真正接入图像编辑时再实现，不先写返回假成功的占位函数。
interface ImageEditor {
  edit(input: EditInput, model: ModelChoice): Promise<StepResult<ImageOutput>>;
}

interface ModelCatalog {
  refresh(): Promise<ModelCandidate[]>;
}

interface PendingResults {
  check(receipt: ProviderReceipt): Promise<StepResult<Analysis | ImageOutput>>;
}

// 云端消息、定时触发或独立进程都只调用这一执行边界。
interface TaskRunner {
  runDue(limit: number): Promise<{ processed: number }>;
}
```

AnalysisInput 用不可变输入标识、共享缩略图字节和规则版本；Analysis 用经过校验的有界标签与简述。EditInput 用照片输入、prompt、参考图和完整配方快照；ImageOutput 返回受限图像字节/经过验证的供应商输出，不直接写数据库。Library/Jobs 决定结果是否应用和保存。

NVIDIA 某些端点文档声明可能返回 202 + requestId；必须核实选定模型对应的结果查询方式，再启用 pending 分支。不能把另一个 NVIDIA 产品的 status 地址套用过来。

## 刷新与选模：保留你的使用习惯

1. 页面刷新时刷新一次候选目录；一次刷新只取目录，不逐个发图片探针。同一时刻重叠的刷新请求合并。
2. 目录必须与我们已验证的协议/能力清单取交集，不能用名字含 vision 就判定能处理照片。目录出现不等于当前 key 有权调用。
3. 对 analyze / editImage 分别记住上次实际成功的模型。如果仍在候选中，优先复用；否则从经过验证的小候选集按固定顺序选择。
4. 真正调用成功才更新 lastSuccessfulModel。页面显示“候选”与“最近成功”，不假称已实时探测全部模型。
5. 创建一批任务时冻结模型；之后刷新页面不能改动这些任务。若该模型失效，中断并明确报告，不在同一批里悄悄换模型。
6. 429 延后同一任务；认证失败停止并提示配置；明确模型撤下才在下一批重选。目录失败、坏输入、超时不是扫描几十个模型的理由。

浏览器不访问 NVIDIA key。key 保存在 Sites 服务端环境；lastSuccessfulModel 和小份目录缓存不含密钥。目录获取端点、完整性和账户权限还需实测，不承诺从公开网页抓取模型表做生产发现机制。

## 任务执行与一致性

- 接受 POST /jobs 前必须确认有可靠执行/唤醒通道。未配置就返回 BACKGROUND_NOT_CONFIGURED，而不是假接受。前台普通上传和人工相册仍可工作。
- Jobs 在 D1 中是唯一任务事实源。消息/定时触发只负责唤醒，重叠唤醒由领取条件防止并发执行同一任务。
- 用条件更新领取短期租约，带执行 token；只有当前 token 能写最终状态，过期执行者不能覆盖新结果。数据库等待不跨外部模型请求。
- 对 analyze 任务，用 owner + 原图内容 hash + 分析规则版本去重；存下所选模型作为来源。换模型不自动重新分析全部照片，用户显式重分析才开新 revision。
- 对 generate，用客户端动作 ID 处理重复点击/网络重试；照片与配方相同但明确点“再生成”仍是新任务，不把创造性变化当重复。
- 常规状态 queued / running / succeeded / failed；提供方已接受但回执丢失、且不能查询时使用 unknown。只做有上限、按错误类别的重试，不承诺供应商端 exactly-once。
- 可查询的 pending 回执持久化后再等待下一次唤醒；不可查询的生成超时不盲目重复提交。标签识别是否允许有限重算作为单独策略。
- AI 标签与任务成功在同一 D1 事务批次提交，同时校验当前执行 token 与照片 revision；冲突时重新读取并应用规则，不标假成功。人工标签、排除标签、人工相册成员不会被模型输出覆盖。
- 图像结果先写 R2，再在 D1 登记引用并完成任务；失败期间只保留有到期时间的临时对象。D1/R2 不是一个跨存储事务，不能宣称原子写入两者。
- 最小日志保留 taskId、modelId、providerRequestId、尝试次数、错误码和耗时；不留整张图的 base64、完整模型原始响应或重复图片副本。

## 为什么后台机制是一个待验证项

Cloudflare HTTP Worker 的 waitUntil 在响应完成或断连后最多延续 30 秒，不是持久任务执行器。D1 tasks 行也不会自己运行。当前 Sites 开放的可靠后台触发方式需要单独验证；图中 Durable Trigger 用虚线和待验证标记。

落地顺序：先做一个“提交任务后关闭所有页面，等待，再重新打开能看到结果”的真实云端测试。若平台没有所需入口，应单独决策新增一个托管执行通道及其成本；不能偷偷把轮询页面当执行器，也不同时引入多套备选系统。Runner 的业务代码与接口保持不变。

## 数据：只新增必要的事实

沿用 photos、files、albums、styles、library_owner；新增 jobs。上次成功模型等小份偏好可附在 library_owner 的配置中，不先增加模型注册中心服务。

- photos：原图/成果种类、fileId、共用缩略图、拍摄时间及来源、人工标签、AI 标签、人工排除标签、原图或拼图来源、recipe 参数。
- files：owner、内容 hash、大小/MIME、objectKey、ready 状态、用途、临时到期时间。内容 hash 由服务端验证；只在同一 owner 内去重。
- albums：标题、说明、有序 photoIds、revision。月度是按图库固定时区的时间查询，不给每个月写一张实际相册记录；拍摄时间缺失需标出日期来源，不把导入时间伪装成拍摄时间。
- styles：prompt、参考文件引用、参数、revision。任务保存快照，配方可继续编辑。
- jobs：类型、输入快照或引用、状态、workKey、所选模型、provider receipt（若有）、lease/token、nextRunAt、结果引用、错误。
- 自动近期分组：第一版复用 group 类型 job 的结果保存有界时间窗中的成员引用和输入版本；GET /groups 读取这些结果，可刷新，不碰手工 albums。数据量与查询形态证明有必要时再做独立 groups 表或更复杂索引。

查询常用字段（owner、拍摄时间、任务状态/nextRunAt、workKey）用列和索引；有限的标签/配方用有界 JSON。不要全库加载、不要把每个 JSON 属性都拆表，也不为几十 GB 的字节数直接引入向量数据库。

## 文件保留：节省空间，不把每一步都当作品

| 类型 | 保留规则 |
| --- | --- |
| 原图 | 一份不可变原始字节，正式引用长期保留 |
| 列表/识图预览 | 同一个文件共用一张缩略图，无需多套 AI 专用尺寸 |
| 色调编辑 | 参数保存；拖动滑杆不上传每帧结果 |
| AI 临时结果 | 短期保留；保存后升级正式引用，尽量直接复用已有文件 |
| 拼图 | 参数 + 源照片引用；保存成品时一张最终图与缩略图 |
| 中间产物 | 默认不保存 |

临时回收只针对到期、无正式引用、无活动任务引用的文件；原图与正式成果不参与。期限先作为明确产品设置，实际回收需实现引用检查与并发保护。图库文件读先鉴权，再处理 ETag/304；首版可用 private,no-cache 复用浏览器字节，不把私图放公共 CDN 缓存。

## 为扩展保留什么，不做什么

保留：稳定的图库 HTTP 契约、Photo/File/Album/Style/Job 标识、AI 类型化输入输出、后台执行入口、可迁移的来源记录。

不做：微服务拆分、内部 HTTP、多供应商自动兜底链、Agent 框架、事件总线、通用 DAG 引擎、Redis、向量数据库、通用 Repository 基类、为了兼容将来 Go 而先维护两套后台。

增加新视觉供应商：实现同一个 AI 接口，Library 与 UI 不变。增加图像编辑：新增具体 handler 与 ImageEditor 实现，复用 Jobs 与文件保存规则。改成 Go/Docker：重新实现相同 HTTP 契约和迁移数据，不承诺 TypeScript 逻辑自动移植。

## 实施前的三个验证

1. 真实后台唤醒：关闭页面后仍执行；重复唤醒不重复完成；执行者失效能恢复。
2. NVIDIA：小批示例验证自有图片输入、目录刷新、上次模型复用、返回格式、限流和 pending receipt 的实际协议。
3. 文件/数据：原图 hash 不变、重复上传复用字节、AI 不覆盖人工标签、模型结果与 job 成功一致提交、临时结果保存不复制整份文件。

这份提案不等于这些验证已经完成。

## 参考与设计取舍

- 当前本地事实：worker/index.ts、.openai/hosting.json、app/api/[...path]/route.ts、server/api.ts、db/schema.ts。
- Martin Fowler, Monolith First：https://martinfowler.com/bliki/MonolithFirst.html 。本提案选择单应用的模块边界，避免微服务的部署与一致性开销。
- Martin Fowler, Yagni：https://martinfowler.com/bliki/Yagni.html 。保留必要边界，不预建未来功能和替代实现。
- Cloudflare waitUntil：https://developers.cloudflare.com/workers/runtime-apis/context/ 。明确短期后台延续与持久任务机制的区别。
- NVIDIA vision reference：https://docs.api.nvidia.com/nim/reference/meta-llama-3_2-11b-vision-instruct-infer 。可接受图片输入，文档也声明 202 pending；选定账户与端点仍需验证。
