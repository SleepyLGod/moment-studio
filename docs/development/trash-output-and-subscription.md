# Trash、输出尺寸与订阅改图

2026-11-03。保留既有英文界面、私有权限、同一repo；只用公开示例验收，不开付费。

## 用户行为

- 单张预览或批量选择可Move to Trash；Trash内可单张/批量Restore。照片从图库、月份、近期分组和新任务中隐藏，人工相册成员关系仍在，恢复后可重新出现。
- 不永久删除、不自动过期、不清理R2文件；因此回收站暂不回收空间。移入时取消未完成任务，旧执行结果不可重新创建记录。恢复不会自动重新调用AI；用户明确点AI tags时才重新排队。
- Style Lab默认Original，以转正后的原始像素为准。当前Cloudflare适配器接受256–2048的16倍数尺寸；不满足则显示错误，用户自己选Custom。此范围是应用约束，非厂商绝对最大尺寸声明。
- 1K/2K match ratio是用户主动选择的预设；能保持精确比例时保持，无法对齐时最多近似1%，不裁剪/拉伸。自定义比例由用户决定。
- 后台任务保存明确尺寸，返回JPEG像素必须一致才成功；任务去重包含尺寸。原图不覆盖，结果只存一个文件，没有新增中间JPEG/额外缩略图。比较预览完整显示，比例不同时留白。

## ChatGPT订阅：能力已证实，网页连接尚未实现

真实调用使用已安装的原生Codex CLI、已有ChatGPT登录及内建image_generation，非外部OAuth预览或OpenAI API key。公开输入为`public/photos/1060.jpg`，输出经独立解码为1422×1106 PNG、2,592,439字节，SHA256 `c0a68091532768051e9012bff67d8bb061c3758c98aa63741a24366918a0b0e1`。请求禁止shell替代绘图与其他生成服务，进程清除OPENAI_API_KEY、CODEX_API_KEY、OPENAI_BASE_URL；原生调用exit0并生成真实图片。脱敏证据见[JSON](evidence/2026-11-03-native-codex-image.json)。

[Codex官方图像生成](https://learn.chatgpt.com/docs/image-generation?surface=cli)与[非交互调用](https://learn.chatgpt.com/docs/non-interactive-mode)支持这个组合。图像生成计入Codex订阅使用，不意味着普通Chat界面额度可直接供第三方网站调用，也未测剩余额度。不能从外部Sign in with ChatGPT预览暂不支持生图，推断原生Codex也不支持。

拟接入流程：网站创建任务 → 运行Codex的执行端领取 → 本机Codex使用本机登录 → 结果上传到现有R2/D1 → 网站显示。现有任务队列可复用；需明确provider/执行端路由、受限任务凭据和输出格式，不能把Cloudflare的JPEG/尺寸约束直接套给原生Codex。

Sites与免费Worker是网页服务运行环境，不能启动原生Codex程序。执行端可在Mac或常开服务器，用户仍只操作网站。若Mac关机则任务等待；若希望电脑关机仍运行则需要常开机器。**目前没有安装/启动常驻Mac执行端、转移登录凭据或连通网站到Codex；选择执行位置仍待用户理解后决定。**

## NVIDIA截图里的14个模型

9个视觉理解/聊天模型（Mistral Large4、Step5、GLM5.3、Muse、Cosmos reasoner、Nemotron omni、Llama Vision11B/90B、PaliGemma）适合标签/描述；1个Parse做OCR；3个Embed/Rerank做检索。它们有用途，但输出分别是文字、向量、分数。

Cosmos3 Nano是生成模型；其[官方模式表](https://build.nvidia.com/nvidia/cosmos3-nano/modelcard)中静态JPEG属于text2image，图像条件模式输出视频等。没有把14个全说成不可用，也没有声称14个全已实测接通。当前生产NVIDIA识图已接通；自动发现未知接口并接入仍未实现。详见[完整目录核实](model-capabilities-and-resolution.md)。

## 验证记录

- 本地68项测试通过；TypeScript、静态演示和Sites构建通过。九组预生成示例来源/资格检查通过。
- 本地浏览器已观察移入Trash后22→21、Trash1张、恢复后Trash为空；是本地数据库验证，不等于线上验收。
- 线上发布与验收结果在完成后补充。
