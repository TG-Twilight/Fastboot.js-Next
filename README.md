# Fastboot.js Next

English | [简体中文](#简体中文)

Fastboot.js Next is a modern WebUSB fastboot workstation built for static hosting. It keeps the core API shape of [kdrag0n/fastboot.js](https://github.com/kdrag0n/fastboot.js) and rebuilds the original demo experience with a Material Design 3 interface, bilingual copy, theme switching, safety prompts, progress feedback, and structured logs.

## Features

- Connect Android devices in bootloader / fastboot mode through WebUSB.
- Run raw fastboot commands such as `getvar`, `reboot`, `erase`, `flashing`, and OEM commands.
- Boot a selected image with `bootBlob`.
- Flash an image to a user-selected partition with `flashBlob`.
- Flash a factory image / update ZIP through `flashFactoryZip`.
- Display connection state, device variables, task progress, and logs.
- Require explicit file selection and confirmation before dangerous boot / flash / ZIP actions.
- Material Design 3 color roles, responsive layout, and light / dark / system themes.
- `zh-CN` and `en-US` i18n with browser-language default and localStorage persistence.

## Tech Stack

- Vite
- TypeScript
- Native Web Components
- CSS custom properties for Material Design 3 tokens
- `android-fastboot` as the fastboot.js core package
- WebUSB API

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The output is written to `dist/` and contains static assets only.

## GitHub Pages

The Vite config uses `/Fastboot.js-Next/` automatically when `GITHUB_ACTIONS` is set. For manual builds:

```bash
VITE_BASE_PATH=/Fastboot.js-Next/ npm run build
```

Publish `dist/` with your preferred GitHub Pages workflow.

## Cloudflare Pages

Use these settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_BASE_PATH=/`

## Browser Compatibility

Fastboot.js Next depends on WebUSB. WebUSB is mainly supported by Chromium-based browsers such as Chrome, Edge, and other compatible desktop Chromium builds. Firefox and Safari do not currently provide the required WebUSB API.

The page must be served from a secure context, such as `https://` or `localhost`.

## Safety Notice

Flashing, unlocking, booting unsigned images, or writing partitions can cause data loss, boot failure, and warranty impact. Fastboot.js Next never automatically executes dangerous operations. Users must explicitly select files, enter partitions or commands, and confirm risky actions.

Always back up data and verify image sources before use.

## Relationship to fastboot.js

This project uses the npm package published from [kdrag0n/fastboot.js](https://github.com/kdrag0n/fastboot.js), currently named `android-fastboot`. The client adapter in `src/core/fastbootClient.ts` calls the same APIs used by the original demo:

- `new FastbootDevice()`
- `device.connect()`
- `device.runCommand()`
- `device.getVariable()`
- `device.bootBlob()`
- `device.flashBlob()`
- `device.flashFactoryZip()`

The UI is a new implementation for Fastboot.js Next.

## License

Fastboot.js Next is licensed under the GNU General Public License v3.0 only. See [LICENSE](LICENSE).

---

## 简体中文

Fastboot.js Next 是一个面向静态部署的现代 WebUSB Fastboot 工具台。项目沿用 [kdrag0n/fastboot.js](https://github.com/kdrag0n/fastboot.js) 的核心 API 形态，并将原始 demo 重做为 Material Design 3 风格界面，提供双语文案、主题切换、安全确认、进度反馈和结构化日志。

## 功能特性

- 通过 WebUSB 连接处于 bootloader / fastboot 模式的 Android 设备。
- 执行 `getvar`、`reboot`、`erase`、`flashing`、OEM 等原始 fastboot 命令。
- 通过 `bootBlob` 启动用户选择的镜像。
- 通过 `flashBlob` 将镜像写入用户指定分区。
- 通过 `flashFactoryZip` 刷写 factory image / update ZIP。
- 展示连接状态、设备变量、任务进度和日志。
- 对 boot / flash / ZIP 等危险操作要求用户选择文件并二次确认。
- 使用 Material Design 3 色彩角色、响应式布局、浅色 / 深色 / 跟随系统主题。
- 支持 `zh-CN` 和 `en-US`，默认跟随浏览器语言，并保存到 localStorage。

## 技术栈

- Vite
- TypeScript
- 原生 Web Components
- 使用 CSS 自定义属性管理 Material Design 3 tokens
- `android-fastboot` 作为 fastboot.js 核心能力来源
- WebUSB API

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`，内容为纯静态资源。

## GitHub Pages 部署

当检测到 `GITHUB_ACTIONS` 时，Vite 配置会自动使用 `/Fastboot.js-Next/` 作为 base。手动构建时可以使用：

```bash
VITE_BASE_PATH=/Fastboot.js-Next/ npm run build
```

然后用你偏好的 GitHub Pages workflow 发布 `dist/`。

## Cloudflare Pages 部署

推荐配置：

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_BASE_PATH=/`

## 浏览器兼容性

Fastboot.js Next 依赖 WebUSB。WebUSB 主要由 Chromium 系浏览器支持，例如 Chrome、Edge 以及其他兼容的桌面 Chromium 浏览器。Firefox 和 Safari 目前不提供所需的 WebUSB API。

页面必须运行在安全上下文中，例如 `https://` 或 `localhost`。

## 安全风险提示

刷机、解锁、启动未验证镜像或写入分区都可能导致数据丢失、设备无法启动和保修受影响。Fastboot.js Next 不会自动执行危险操作。用户必须明确选择文件、输入分区或命令，并确认风险操作。

使用前请备份数据，并确认镜像来源可信。

## 与 fastboot.js 的关系

本项目使用 [kdrag0n/fastboot.js](https://github.com/kdrag0n/fastboot.js) 发布到 npm 的包，目前包名为 `android-fastboot`。`src/core/fastbootClient.ts` 中的 client 适配层调用了原版 demo 使用的同一组 API：

- `new FastbootDevice()`
- `device.connect()`
- `device.runCommand()`
- `device.getVariable()`
- `device.bootBlob()`
- `device.flashBlob()`
- `device.flashFactoryZip()`

Fastboot.js Next 的界面和工程结构是新的实现。

## License

Fastboot.js Next 使用 GNU General Public License v3.0 only 授权。详见 [LICENSE](LICENSE)。
