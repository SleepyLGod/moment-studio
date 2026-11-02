# Sites + GitHub Pages

采用两个网站、两种用途，共享品牌和经过挑选的公开演示素材。

| 部分 | 用途 | 当前状态 |
| --- | --- | --- |
| moment-studio 私有仓库 | 完整工作台源码、修改历史、构建检查 | 本轮整理并推送 |
| Sites | 私人工作台的主要托管位置 | 有早期私有版本；当前英文新版尚未部署 |
| GitHub Pages | 公开介绍、示例效果、进入工作台的链接 | 建议独立展示项目；尚未创建或发布 |

## Sites：工作台

现有项目身份保留在 `.openai/hosting.json`。静态构建输出是 `dist/`。

现有地址：<https://moment-studio-sleepylgod-demo.von-lu-cuhk.chatgpt.site>

该地址目前限制为所有者访问。公开展示页链接到这里，不会自动让访客获得工作台访问权限；需要分享时，再调整 Sites 的访问名单。

新版源代码推到 GitHub 不会自动更新 Sites。发布时仍需要由 Sites 保存和部署对应的源代码版本；不能把 GitHub commit 当成已部署证明。

## GitHub Pages：展示页

保留现有个人主页 <https://sleepylgod.github.io/>。

推荐后续单独建立公开展示仓库，例如 `moment-showcase`。项目页可以使用 `https://sleepylgod.github.io/moment-showcase/`，无需替换个人主页。这是建议地址，目前并未发布。

展示页只包含介绍、挑选的演示图和 Sites 入口，不包含真实照片、图库备份、API 密钥或账户数据。默认按公开网站设计；私有源码仓库不代表 Pages 网页也私有。

如果希望完整源码保持私有，而展示网站对外公开，可以把展示素材放在单独的公开仓库。这样不依赖私人仓库发布 Pages 的套餐资格。

## 数据与同步

当前工作台仍是浏览器本地原型。照片、相册、Style 配方在当前网址的 IndexedDB 中；localhost、Sites 和 GitHub Pages 是不同来源，不会自动共享这些记录。

Sites 部署当前界面也不会自动得到几十 GB 云图库或实时 AI 服务。真正的照片存储、登录后的持久化、AI 模型和公开相册发布机制，需要后续接入。

源码仓库、网站托管、公开展示和图库存储是四个可独立维护的部分。
