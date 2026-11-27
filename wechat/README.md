# 光储电站微信小程序

在微信开发者工具中导入本目录，项目入口为 `project.config.json`。小程序通过 `web-view` 打开同一服务的 `/wechat/index.html`，共享电站数据、控制权限和小源接口。管理人员继续在浏览器访问 `/manage/`。

当前开发版使用 `https://fssolarhw.online/wechat/index.html`。可在微信开发者工具点「真机调试」并扫码。分享体验版前，需在微信公众平台确认该地址的业务域名已验证。

- **本地预览**：在光储服务项目根目录运行 `node server.mjs` 后，在开发者工具的「详情 → 本地设置」中临时勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。如需在模拟器测试本地服务，可临时清空 `miniprogram/config.js` 的 `serviceOrigin`，开发版会使用 `deviceDebugOrigin`。真机联调时恢复 HTTPS 地址。
- **真机和发布**：使用具备 `web-view` 能力的小程序账号，把 `project.config.json` 的 `appid` 改为实际 AppID，将新版用户端和后端部署到 HTTPS 域名。在微信公众平台配置业务域名，并按平台提示将微信生成的校验文件原样放入服务项目的 `public/`，确认通过域名根路径可以读取。将 `miniprogram/config.js` 的 `serviceOrigin` 填为该 HTTPS 源地址，再在开发者工具预览或上传。
- **联调**：浏览器打开管理端并运行电站，在小程序检查电站列表、设备、告警和小源对话。控制操作仍使用 APP 控制码。上传图片、语音和文件相关能力需要在目标微信版本上实测。
