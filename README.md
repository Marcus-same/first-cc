# 番茄钟桌面应用

一个基于 Electron 的番茄工作法定时器，帮助你保持专注。

## 功能

- 番茄计时器（默认 25 分钟工作 + 5/15 分钟休息）
- 可自定义工作/休息时长
- 每日统计（完成番茄数、专注分钟、工作轮次）
- 桌面通知（计时结束时提醒）
- 系统托盘（隐藏到托盘，点击恢复）
- 本地存储（设置和统计自动保存）

## 运行应用

```bash
# 安装依赖
npm install

# 启动 Electron（需要先下载 Electron 二进制）
npm start
```

如果 `npm start` 失败，可能需要先运行：
```bash
node node_modules/electron/install.js
```

## 打包应用

```bash
npm run build
```

打包后的可执行文件在 `dist/` 目录。

## 项目结构

```
├── assets/
│   └── icon.png          # 应用图标
├── src/
│   └── main.js           # Electron 主进程
├── index.html            # 渲染进程（UI）
├── package.json
├── SPEC.md               # 规范文档
└── README.md
```
