# Tempo

本地日历应用，支持 Mac 桌面窗口和浏览器预览。当前不包含 Google、Outlook 或 CalDAV 云端同步。

## 安装与启动

使用 Node.js 22.12+，在项目根目录执行：

```sh
npm ci
node node_modules/electron/install.js
npm start
```

`npm start` 会构建并打开桌面窗口。日历保存在 `~/Library/Application Support/Tempo/tempo.db`。

浏览器开发预览：

```sh
npm run dev
```

打开 http://127.0.0.1:5300/。浏览器数据与桌面数据分别保存。

## 验证

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
# 保持 npm run dev 运行，在另一个终端执行：
node packages/parity/behaviour.mjs
```

Mac 本机已通过 18 项基础测试和 50 项浏览器交互检查，并检查桌面窗口、菜单、新建日程与重启保存。`packages/parity/electron.mjs` 是原有 Linux/Xvfb 专用测试，未改为 Mac 测试。
