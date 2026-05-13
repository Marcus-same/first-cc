# 知识库

## 结构

```
knowledge-base/
├── hr-knowledge/     # HR 相关：招聘、培训、HRBP 资料
├── ai-knowledge/     # AI 小组相关：技术方案、Prompt 模板、踩坑笔记
├── conventions/      # 工作约定、规范文档
└── archive/          # 归档：历史会话摘要、已结项项目
```

## 入库工具

### AI 小组知识库
```bash
python ingest.py --file "文件路径"
python ingest.py --folder "文件夹路径"
python ingest.py --url "URL"
python ingest.py --text "内容" --title "标题"
```
- 飞书 Base：`KCXjbOD2bafH9Us4hNIcXIRWnLd`
- 表：资料库 `tblseNb1pQVBMnGW`
- 需要环境变量：`DEEPSEEK_API_KEY`

### HR 知识库
```bash
python ingest_hr.py --file "文件路径"
python ingest_hr.py --folder "文件夹路径"
python ingest_hr.py --url "URL"
python ingest_hr.py --daemon    # 后台自动处理
python ingest_hr.py --sync      # 单次同步
```
- 飞书 Base：`TpoSbBr6QaXUDFs4abYcEJQEnUd`
- 表：`tblac5PrdBNBj8Nn`
- 支持视频转文字（FunASR/Baidu/Whisper）、小红书抓取（Playwright）

## 文档生成

```bash
python build_docx.py
```
- 默认输出到 `knowledge-base/ai-knowledge/AI小组实施方案_已优化.docx`
- 可通过环境变量 `DOCX_OUTPUT_DIR` 和 `DOCX_FILENAME` 自定义

## 规范

- 所有产出物存 D 盘，不存 C 盘
- 入库内容需有标题、来源、日期
- 定期清理临时文件和过期缓存
