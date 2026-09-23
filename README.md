# Fastboot.js Next

[简体中文](#简体中文) | English

Flash Android devices from the browser. Fastboot.js Next talks the fastboot protocol directly over WebUSB, so there is nothing to install besides a Chromium-based browser.

> [!WARNING]
> Flashing, unlocking or erasing partitions can wipe your data or brick your device. Only flash images you trust and made for your exact model.

## Features

- Connect to devices in bootloader or fastbootd mode, read `getvar all`, reboot, switch slots
- Flash any partition, with automatic A/B slot suffixes
- Images larger than `max-download-size` are resparsed and sent in pieces, raw or sparse
- Boot an image without flashing it
- Flash a complete factory image (Google's outer ZIP or the `image-*.zip` inside it):
  bootloader and radio, `android-info.txt` checks, `fastboot-info.txt`, dynamic partitions through fastbootd, optional wipe
- Automatically reconnects after each reboot, and asks you to pick the device again when the browser cannot
- Raw command console that also accepts CLI syntax (`getvar product`, `reboot bootloader`)
- Chinese and English UI, light and dark themes

## Browser and OS requirements

- Chrome, Edge or another Chromium-based browser, on desktop or Android. Firefox and Safari have no WebUSB.
- The page must be served over HTTPS or from `localhost`.
- **Windows**: the device needs the WinUSB driver. Install the [Google USB Driver](https://developer.android.com/studio/run/win-usb) and close any running `adb` / `fastboot`.
- **Linux**: add a udev rule granting access to the device, e.g. the [android-udev-rules](https://github.com/M0Rf30/android-udev-rules) package.
- **macOS**: works out of the box.

## Development

```bash
npm install
npm run dev        # dev server on http://localhost:5173
npm test           # unit tests (protocol, sparse images, factory flashing)
npm run build      # type check and build into dist/
```

`main` is built and deployed to GitHub Pages by `.github/workflows/ci.yml`. For another host, build with `VITE_BASE_PATH=/` (or whatever path the site lives under) and serve `dist/`.

## Project layout

```
src/fastboot/   Framework-independent fastboot implementation
  transport.ts    WebUSB transport
  device.ts       Protocol: commands, getvar, download, flash, boot, slots
  sparse.ts       Android sparse image parsing and splitting
  factory.ts      Factory image flashing (mirrors `fastboot update`)
  usb.ts          Device picker and reconnect helpers
src/app/        Application state: session, log, theme, confirmation
src/components/ Vue components
src/i18n/       Translations
tests/          Vitest suites, run against a simulated fastboot device
```

The `src/fastboot` directory has no dependency on Vue and can be reused on its own.

## Credits

Inspired by [kdrag0n/fastboot.js](https://github.com/kdrag0n/fastboot.js). Protocol details follow AOSP's [fastboot](https://android.googlesource.com/platform/system/core/+/refs/heads/main/fastboot/) and [libsparse](https://android.googlesource.com/platform/system/core/+/refs/heads/main/libsparse/).

## License

[GPL-3.0-only](LICENSE)

---

## 简体中文

在浏览器里给 Android 设备刷机。Fastboot.js Next 通过 WebUSB 直接实现 fastboot 协议，除了一个 Chromium 内核浏览器外无需安装任何东西。

> [!WARNING]
> 刷写、解锁或擦除分区可能导致数据丢失或设备变砖。请只刷入可信且与设备型号完全对应的镜像。

### 功能

- 连接处于 bootloader 或 fastbootd 模式的设备，读取 `getvar all`，重启，切换槽位
- 刷写任意分区，自动处理 A/B 槽位后缀
- 超过 `max-download-size` 的镜像（raw 或 sparse）会自动重新拆分为多个 sparse 镜像分段发送
- 临时启动镜像（不写入）
- 线刷完整的官方线刷包（Google 提供的外层 ZIP 或其中的 `image-*.zip`）：
  刷写 bootloader 和基带、校验 `android-info.txt`、支持 `fastboot-info.txt`、通过 fastbootd 刷写动态分区、可选清除数据
- 每次重启后自动重连；浏览器无法自动重连时提示重新选择设备
- 命令行，支持 CLI 写法（`getvar product`、`reboot bootloader`）
- 中英文界面，浅色 / 深色主题

### 浏览器与系统要求

- Chrome、Edge 或其他 Chromium 内核浏览器（桌面版或 Android 版）。Firefox 和 Safari 不支持 WebUSB。
- 页面必须通过 HTTPS 或 `localhost` 访问。
- **Windows**：设备需要 WinUSB 驱动。请安装 [Google USB Driver](https://developer.android.com/studio/run/win-usb)，并关闭正在运行的 `adb` / `fastboot`。
- **Linux**：需要添加 udev 规则授予设备访问权限，例如安装 [android-udev-rules](https://github.com/M0Rf30/android-udev-rules)。
- **macOS**：无需额外配置。

### 开发

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm test           # 单元测试（协议、sparse 镜像、线刷流程）
npm run build      # 类型检查并构建到 dist/
```

`main` 分支由 `.github/workflows/ci.yml` 自动构建并部署到 GitHub Pages。部署到其他平台时，使用 `VITE_BASE_PATH=/`（或站点所在路径）构建后发布 `dist/`。

`src/fastboot` 目录不依赖 Vue，可以单独复用。

### 致谢

灵感来自 [kdrag0n/fastboot.js](https://github.com/kdrag0n/fastboot.js)。协议细节参考 AOSP 的 [fastboot](https://android.googlesource.com/platform/system/core/+/refs/heads/main/fastboot/) 与 [libsparse](https://android.googlesource.com/platform/system/core/+/refs/heads/main/libsparse/)。

### 许可证

[GPL-3.0-only](LICENSE)
