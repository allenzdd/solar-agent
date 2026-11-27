# 光储监控应用

监控页面、光储仿真台与服务端模型接口。默认模型为 `deepseek-flash`，密钥只由后端读取。Node.js 20.12+，无第三方运行依赖。

已加入可多轮调用电站工具的 Agent loop，以及统一电站 REST 接口。架构、工具清单、数据能力边界和配置见 [Agent 架构与接口说明](docs/agent-architecture.md)。接口描述可在运行后访问 `/api/workspace/data/openapi.json`。

## 启动

- Windows：双击 `start-local.cmd`。
- Linux：`sh ./start-local.sh`。
- 通用：`npm start`，或 `node server.mjs`。
- 配置：私有 `.env`，字段模板见 `.env.example`，已有系统环境变量优先。
- APP 使用端：`http://localhost:8788/app/`，仿真管理端：`http://localhost:8788/manage/`。根地址兼容 APP，旧 `simulator.html` 兼容管理端。
- HTTP 和 HTTPS 的 Web 入口均为 `/app/`。电脑可切换并记住手机或 PC 视图，手机横竖屏均使用手机视图。小程序通过自己的 web-view 进入 `/wechat/index.html`。
- Web 和小程序共用 `/api/workspace/` 读取管理面发布的电站数据。部署时将两个协议入口和小程序的业务域名指向同一个后端工作区。
- 显示模式：在「我的 → 设置 → 深色模式」选择深色或浅色，浏览器会保存选择，并同步到同来源的仿真页面。

首次启动缺少 `.env` 时，一键启动脚本会创建模板，填写密钥后再次启动。具体步骤见 [本地配置说明](本地配置说明.md)。

## 微信小程序用户端

微信开发者工具可直接导入 [wechat/](wechat/)。本地预览、业务域名配置和联调步骤见[小程序说明](wechat/README.md)。

## 代码结构

```text
public/
  index.html               监控页面结构
  simulator.html           仿真台页面结构
  css/                     两个页面的样式
  js/api-client.js         API 请求、流式解析与错误处理
  js/monitor-ai.js         模型状态、会话生命周期与问答 UI
  js/monitor.js            监控、电站上下文、图表和页面交互
  js/simulator.js          仿真引擎、运行参数和浏览器数据同步
  js/app-bridge.js         APP 的服务端快照与控制指令适配
  js/manager-bridge.js     管理登录、运行权、配置上传与指令执行确认
  js/workspace-client.js   两端共用的工作区 API 客户端
server/api.mjs             两种部署环境共用的模型 API
server/workspace.mjs       共享电站配置、快照、运行权与控制队列
server/file-store.mjs      Node.js 原子文件持久化
server/static.mjs          本地静态文件服务
server.mjs                 Node.js HTTP 入口与流式响应适配
worker/index.js            Sites Worker 入口
scripts/build.mjs          生成 Worker 与内嵌公共资源
tests/                     API、流式解析、静态资源与运行时回归检查
```

`dist/` 是可重新生成的产物；不要在其中开发。原有页面的 inline 事件处理器继续由经典脚本提供，新增独立功能优先单独建模块，再由页面业务层组合。不要把服务端配置和密钥引入浏览器脚本。

## 接口与配置

- `GET /api/health`：健康状态、模型名与是否配置密钥，不调用模型。
- `GET /api/config`：前端使用的公开模型配置，不返回密钥。
- `POST /api/chat`：文字/图片问答，支持 SSE 流式输出与取消生成。

模型名、API 地址、请求超时和每分钟限流通过环境变量配置，详见 `.env.example`。请求里的模型名无法覆盖服务端配置。本地和 Worker 复用同一套校验、限流、错误格式及模型转发逻辑。内存限流仅对单个进程或 Worker 实例生效；多实例部署需要共享限流存储。

## 开发与发布

```sh
npm test       # 构建并检查 API、浏览器脚本与两种运行时
npm run build  # 仅生成 Sites Worker 部署产物
```

在 ECS 使用 Node.js 入口即可，不依赖 Sites 或其他第三方应用平台。域名、IP 和内网穿透访问均不需要配置来源地址，后端不再校验 Origin，旧版 `PUBLIC_ORIGIN` 配置可删除。前端继续通过同站点 `/api/chat` 调用模型。若通过 Nginx 等反向代理提供 HTTPS，请关闭代理的 SSE 缓冲（如 `proxy_buffering off`）。代理后默认按连接来源限流，不会自动信任客户端传来的 IP 请求头。

## 两端分离与共享数据

管理端负责创建、编辑电站与运行仿真；APP 只显示服务端共享电站，不再混入旧版示例电站、告警和设备。两端在同一后端的不同链接下工作，可在不同浏览器或设备打开。

- 管理登录使用 `.env` 的 `MANAGER_TOKEN`。首次直接启动会为缺失或示例值生成随机口令并保存到 `.env`。
- APP 查看电站和模型对话无需管理口令。修改参数、启停或删除电站需要 `APP_CONTROL_TOKEN`，可在 APP「我的 → 设置 → APP 控制权限」输入；管理端登录后可查看此控制码。
- 每次仅一个管理页拥有运行权。其他管理页需显式“接管运行”，旧页随即停止上传，避免相互覆盖。
- 管理页约每 3 秒上传快照，APP 约每 2 秒读取。浏览器本地存储只保留外观、旧配置备份与管理页缓存，不再承担跨端通信。
- Node.js 将数据原子保存到 `data/workspace.json`；可用 `DATA_DIR` 指向持久化目录。适合单个 Node.js 进程，不要让多个进程共写同一文件目录。
- Sites 通过 `.openai/hosting.json` 的 `BUCKET` R2 绑定保存同一工作区，使用条件写入重试防止并发覆盖。
- **仿真引擎仍在管理页运行。** 关闭或休眠管理页后仿真暂停，服务器保留最后配置和快照，APP 会提示停更；这版没有后台持续计算服务。

首次登录新管理端时：服务器已有配置则优先恢复服务器配置；服务器为空时导入该浏览器原有电站（先保存本机备份），没有旧配置才创建一座演示站。负载曲线随电站配置持久保存。不要把仅修改 `public/` 的旧前端补丁用于此次升级，需要更新完整后端与脚本。

新增接口统一位于 `/api/workspace/`：公开读取 `state`；管理鉴权读取/写入 `config`、发布 `state`、获取 `lease`；有控制权限的 APP 提交 `commands` 并读取执行结果。两个部署入口共用一套数据，后续可在此层增加账号、设备接入与数据库适配器。
