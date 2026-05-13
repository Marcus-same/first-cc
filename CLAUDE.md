# first-cc 项目规范

## 项目简介
- **番茄钟桌面应用**（Electron）：番茄工作法定时器，含系统托盘、桌面通知、每日统计
- **知识库入库工具**（Python）：飞书多维表格（Base）内容摄入，含 AI 摘要、视频转文字、小红书抓取

## 技术栈
- Electron 42、Node.js
- Python 3.12：python-docx、Playwright、FunASR/Whisper
- 飞书 API（lark-cli、Base、Docs）
- DeepSeek API

## 目录结构
```
first-cc/
├── src/               # Electron 主进程 + preload
├── index.html         # 番茄钟 UI（单文件）
├── assets/            # 图标等资源
├── knowledge-base/    # 知识库产出（HR/AI/规范/归档）
├── ingest.py          # AI 小组入库工具
├── ingest_hr.py       # HR 知识库入库工具（全功能版）
├── build_docx.py      # Word 文档生成器
└── dist/              # Electron 构建产物
```

## 知识库 Base
- AI 小组：Base `KCXjbOD2bafH9Us4hNIcXIRWnLd` Table `tblseNb1pQVBMnGW`
- HR 知识库：Base `TpoSbBr6QaXUDFs4abYcEJQEnUd` Table `tblac5PrdBNBj8Nn`

## 常用命令
```bash
npm start             # 启动 Electron
npm run build         # 打包应用
python ingest.py --file "path"     # AI 小组入库
python ingest_hr.py --file "path"  # HR 知识库入库
python ingest_hr.py --daemon       # 后台轮询模式
python build_docx.py               # 生成 Word 文档
```

## 输出约定
- Electron 构建 → `dist/`
- 知识库产出 → `knowledge-base/`
- Python 脚本输出默认 D 盘，不写 C 盘
- 临时文件及时清理，不提交到 Git

## 会话归档
- 涉及重要决策的会话，结束后保存 Markdown 摘要到 `knowledge-base/archive/YYYY-MM-DD-主题.md`
- 摘要包含：讨论内容、决策、产出、待办
- 原始 JSONL 日志位置：`C:\Users\Administrator\.claude\projects\D--first-cc\`
- 查历史对话：优先看 archive 摘要，摘要里找不到再问我 grep JSONL
