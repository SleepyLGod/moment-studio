# 图片尺寸、NVIDIA 模型与订阅接入核实

2026-11-03，香港时间。此轮是核实与独立试验：没有修改线上默认512px，没有开付费，没有调用OpenAI付费服务，也没有把真实私人照片传给新服务。

## 先看实际图片结果

512px是上一版产品代码的固定设置，不是免费账户的尺寸上限。使用现有Cloudflare Free账户、公有照片和相同纸雕prompt，直接请求非正方形输出，未对结果做后期放大或拉伸：

| 样本 | 原图比例 | 请求并实际得到的尺寸 | 模型执行时间 | 文件大小 |
| --- | --- | --- | --- | --- |
| 项目咖啡照片 | 9:7 | 1440×1120 | 5.902秒 | 1.16 MB |
| 项目咖啡照片 | 9:7 | 2016×1568 | 8.091秒 | 1.97 MB |
| 公开EXIF方向样本，先转正 | 2:3 | 768×1152 | 4.463秒 | 0.60 MB |

三个响应都为200，已解码检查实际像素和SHA，横竖比例与样本一致。最大**已验证**约3.16MP；这不是声称厂商的绝对上限。Cloudflare当前公开schema仅声明multipart，没给出详细尺寸范围；不能拿另一供应商的上限替代它的合同。[模型/schema](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/)

本轮另有两个尺寸请求未拿到可验证图片：1008×784返回非JSON但首个脚本未保留状态码，1152×896返回404 HTML。它们不计成功，也不当作模型尺寸不支持的证据，不自动重复不确定推理。尝试从公开iPhone HEIC样本经macOS转换的另一输入在本地解码失败，未发送模型；这不替代已通过的网站HEIC导入验收。

大图试验后账户看板显示约**1.03k/10k neurons**，包含此前使用；试验前最近一次读数436.52。计数有延迟且末次四舍五入，响应也没有usage字段，不能给每张图编造精确消耗。本轮没有启用Paid。Free额度是每天10,000 neurons，较大尺寸可以在其中使用；额度用完报错。[官方计费规则](https://developers.cloudflare.com/workers-ai/platform/pricing/)

大图能生成，不等于能恢复原图中不存在的细节。本轮发送已有768px预览，验证的是输出尺寸与比例；后续高清任务仍要权衡输入清晰度和传输体积。

## NVIDIA：本次到底查了什么

逐页检查官方Models页面Optimized by NVIDIA标签下当前全部**105项**，其中**45项**标注Free Endpoint；另看了相关模型卡、API参数和已弃用SDXL入口。目录事实快照见[105项清单](evidence/2026-11-03-nvidia-catalog-audit.json)。没有把网页目录枚举说成105次模型调用。

| 候选 | 模型能做什么 | NVIDIA当前提供的入口/合同 | 对当前图库的结论 |
| --- | --- | --- | --- |
| [Qwen Image Edit](https://build.nvidia.com/qwen/qwen-image-edit/modelcard) | 自有图＋文字→改图，含风格迁移 | 目录标Downloadable；API Reference指向NIM自部署文档，没有Free Endpoint标记 | 任务合适；没有确认NVIDIA免费托管入口。不能说模型不支持 |
| [Qwen Image](https://build.nvidia.com/qwen/qwen-image) | 文字生成图 | Downloadable | 不作为本轮自有照片改图入口 |
| [FLUX.1 Kontext](https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_1-kontext-dev-infer) | 图片编辑 | Preview合同要求example_id为0–2 | 当前托管预览不能用于上传自己的照片；不等于自部署模型不能编辑 |
| [FLUX.2 Klein](https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_2-klein-4b-infer) | 图片生成与编辑 | Preview合同要求example_id为0–3 | 同上 |
| [FLUX.3 Image Klein](https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux-3-image-klein-infer) | 图片生成与编辑 | 同样要求example_id为0–3 | 同上；本轮单独核实，未把FLUX.2限制套给它 |
| [Cosmos3 Nano](https://build.nvidia.com/nvidia/cosmos3-nano/modelcard) | 文生图、文生视频、图生视频等 | Free Endpoint，接受自有图片；官方模式表中静态JPEG输出仅在text2image，图像条件用于视频/动作模式 | 不是通用单张照片改图接口；不通过截视频帧来伪装成直接改图 |
| [Cosmos Transfer2.5](https://build.nvidia.com/nvidia/cosmos-transfer2_5-2b) | 基于空间控制的视频变换 | Free Endpoint | 是视频业务，不是当前单张照片风格Lab的直接接口 |
| [Qwen NVPCB](https://build.nvidia.com/nvidia/qwen-image-edit-nvpcb-ovsl2sl) | 电路板合成图→特定实拍光照风格 | Downloadable，固定PCB任务和训练prompt | 不能当成通用生活照片风格模型 |
| [SD3.5 Large](https://build.nvidia.com/stabilityai/stable-diffusion-3_5-large)、FLUX.1 dev/schnell | 文字生成图 | 目录Downloadable，相关托管合同是文生图 | 不能仅因输出图片就认定能按输入照片编辑 |
| [SDXL旧入口](https://build.nvidia.com/stabilityai/stable-diffusion-xl) | 文生图 | Deprecated Free Endpoint；参数不含自有图 | 不作为新接入方案 |
| [Relighting](https://build.nvidia.com/nvidia/relighting) | 视频人物重打光，HDRI条件 | Downloadable，专用任务 | 可另作将来功能，不是prompt通用改图的替代 |

另外，Nemotron、Llama Vision、Mistral Large等视觉语言模型可以做照片内容理解。NVIDIA并非“一个能用的都没有”：网站已有NVIDIA识图/打标签。

**准确结论：**当前查到的NVIDIA目录和候选合同中，尚未确认一个同时满足“免费托管＋自有照片＋任意prompt编辑＋静态新图片输出”的通用入口。不是断言不存在未来或未公开入口，也不是判定Cloudflare/FLUX永远最好。本轮没有NVIDIA改图调用成功的证据，不能写成实测失败。Downloadable不等于云端永久免费；Partner Endpoint也不自动继承NVIDIA免费额度。

## 自动刷新该怎样做

当前代码`server/ai/catalog.ts`只登记一个识图profile；刷新会查最新目录，但只核对这个已登记profile。它**还不是完整模型发现/检测系统**。

建议保留小而明确的两步，避免“有模型名就盲接”：

1. 刷新目录：缓存供应商返回的模型ID和检查时间，标出识图/改图、是否有已支持的接口。这个步骤不发送照片。NVIDIA聊天目录与视觉生成接口分开核实，不能假设一个/v1/models覆盖所有NIM。
2. 核实可调用：已支持的适配器通过公开小样本、限次检测后，记录最后成功模型、请求方式、尺寸和时间；新任务优先复用仍兼容的最近成功模型。新发现但合同未知的模型列为待接入，不自动成为默认。

统一边界只要`analyze(image)→tags`与`edit(image,prompt,outputSize)→image`两类。供应商适配器处理HTTP/异步格式，任务层处理去重与状态，图库层处理原图/结果关系。模型调用失败不会跳到付费服务，也不会对结果未知的任务换模型重生。

## OpenAI：只用用户已有subscription

用户已明确排除所有OpenAI单独付费API与API赠额路线。这里仅核实**直接消耗ChatGPT订阅额度**。

[官方Sign in with ChatGPT](https://developers.openai.com/siwc/quickstart)确实支持符合条件的用户授权应用使用订阅额度，所以不能沿用“订阅永远不能供外部程序使用”的旧说法。

但[当前订阅接入预览限制](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)明确列出：图像输入可供支持的模型理解，**Image generation工具不支持**；Codex app-server也适用同一限制。因此这条官方授权目前可以研究用于标签/文字任务，不能据此承诺Style Lab可用订阅自动生图/改图。使用ChatGPT/Codex自身界面里的生图是另一种产品使用方式，不能等同于网站已拿到调用权限。

[官方范围](https://developers.openai.com/siwc/token-sharing-open-source)说明开源/本地工具的路径；远程托管应用需走对应接入流程，[合作应用client ID](https://developers.openai.com/siwc/request-client-id)目前有准入。现有Sites“登录身份”也不自动授予“使用订阅额度”的权限。本轮没有发起OAuth、读取登录cookie、转移Codex凭据、注册合作应用或执行OpenAI模型调用。

## 后续Settings：三个分区就够

| 分区 | 用户看到什么 | 行为 |
| --- | --- | --- |
| Connections | NVIDIA、Cloudflare、ChatGPT subscription各自状态；连接/断开 | 清楚区分服务登录与推理权限；不放OpenAI付费API入口 |
| Models | 识图模型、改图模型；Auto / 手动；Refresh；最近成功与检查时间 | Auto只在已接通、任务兼容、验证过的模型里选，优先上次成功 |
| Output | 默认Original ratio；标准/高清尺寸；Free only | 允许模型尺寸对齐时轻微近似，禁止自动裁成正方形/拉伸；预览也按原比例显示 |

额度暂只提供供应商真实看板链接和本应用任务数；没有账户用量读取能力时，不伪造余额条。连接状态、能力和尺寸可保存成非秘密设置；密钥/令牌留服务端安全存储。

建议下一次实施：先去掉任务和执行器里的固定512，按原图宽高比计算经过验证的尺寸，同时修正预览裁切；再接上述Settings。高清默认应结合效果和存储决定，本轮没有擅自扩大线上生成/保存尺寸。

## 可复核材料

- [尺寸请求/实际像素/哈希/失败与额度](evidence/2026-11-03-image-resolution.json)
- [当前105项目录的名称、链接和入口标记](evidence/2026-11-03-nvidia-catalog-audit.json)
- 生成的公开样本保留在本地工作目录`work/resolution-validation-2026-11-03`，不额外复制进R2或Git资源库。
- 临时验证Worker的公开入口已关闭；原有产品Worker、仓库可见性和人工相册均未修改。
