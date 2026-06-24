# first-cc 项目规范

## 项目简介
- **番茄钟桌面应用**（Electron）：番茄工作法定时器，含系统托盘、桌面通知、每日统计
- **知识库入库工具**（Python）：飞书多维表格（Base）内容摄入，含 AI 摘要、视频转文字、小红书抓取（Marcus的知识库）
- **公众号监控** → 独立项目 [`D:\projects\blog-monitor\`](../projects/blog-monitor/)：监控小红书博主+微信公众号动态，自动抓取原文+AI摘要+飞书推送+Web面板

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
├── knowledge-base/    # Marcus的知识库（三层架构：本地md + 飞书Base + 知识卡片）
├── ingest_hr.py       # 知识库入库工具（全功能版）
├── kb.py              # 知识库管理工具（index/search/stats/review/card）
├── build_docx.py      # Word 文档生成器
```

## 知识库 Base
- HR 知识库：Base `TpoSbBr6QaXUDFs4abYcEJQEnUd` Table `tblac5PrdBNBj8Nn`
- 知识总索引：Base `TpoSbBr6QaXUDFs4abYcEJQEnUd` Table `tblZM9cbdh9CVRkm`

## 常用命令
```bash
npm start             # 启动 Electron
npm run build         # 打包应用
python ingest_hr.py --file "path"  # 文件入库
python ingest_hr.py --file "path" --local  # 入库并生成本地md
python ingest_hr.py --daemon       # 后台轮询模式
python kb.py add --url "链接"     # 一键入库（AI自动分类+本地+飞书）
python kb.py add --file "路径"     # 一键入库（文件）
python kb.py add --text "内容"     # 一键入库（文字）
python kb.py search "关键词"       # 联合搜索
python kb.py stats                 # 知识库统计
python kb.py review                # 今日待复习
python build_docx.py               # 生成 Word 文档
```

## 知识库约定
- 本地目录树：`knowledge-base/hr/` `tools/` `growth/` `projects/` `conventions/` `archive/`
- 知识条目格式：frontmatter（title/category/tags/source/date/status/importance）+ 一句话总结 + 关键内容 + 我的思考
- 分类路径规范：如 `hr/招聘面试`、`tools/AI工具`
- 知识卡片模板：`knowledge-base/conventions/模板/知识卡片模板.md`
- 飞书 Base 总索引：统一结构化检索入口（待创建）

## 输出约定
- Electron 构建 → `dist/`
- 知识库产出 → `knowledge-base/`
- Python 脚本输出默认 D 盘，不写 C 盘
- 临时文件及时清理，不提交到 Git

## 手机桥接
- 飞书群「Codex Bridge」（`oc_f2ae3639d64ccd8bb8684c384ec22429`）
- 手机飞书往群里发任务，我读到后直接群里回复
- 读取：`lark-cli im +chat-messages-list --as user --chat-id oc_f2ae3639d64ccd8bb8684c384ec22429`
- 回复：`lark-cli im +messages-send --as bot --chat-id oc_f2ae3639d64ccd8bb8684c384ec22429 --msg-type text --content ...`

## 会话归档
- 涉及重要决策的会话，结束后保存 Markdown 摘要到 `knowledge-base/archive/YYYY-MM-DD-主题.md`
- 摘要包含：讨论内容、决策、产出、待办
- 原始 JSONL 日志位置：`C:\Users\Administrator\.Codex\projects\D--first-cc\`
- 查历史对话：优先看 archive 摘要，摘要里找不到再问我 grep JSONL
