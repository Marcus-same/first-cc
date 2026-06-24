# Marcus的知识库

> 融合飞书知识库（结构化检索 + API自动化）与语雀（树形目录 + 知识卡片）之长处的个人知识管理系统。

## 三层架构

```
展示层: Claude Code问答 · 飞书搜索 · 本地浏览
编排层: 分类体系 · 知识卡片 · 关联图谱 · 间隔复习
存储层: 本地 Markdown (Git版本化) + 飞书 Base (结构化索引)
```

## 目录结构

```
knowledge-base/
├── INDEX.md            # 全局知识地图
├── hr/                 # HR专业知识
│   ├── 招聘面试/        ├── 培训发展/
│   ├── 薪酬绩效/        ├── 员工关系/
│   ├── 组织发展/        └── 劳动法务/
├── tools/              # 效率工具
│   ├── AI工具/          ├── 自动化脚本/
│   └── 办公技能/
├── growth/             # 个人成长
│   ├── 沟通表达/        ├── 职业规划/
│   └── 职场关系/
├── projects/           # 项目归档
├── conventions/        # 规范与模板
│   ├── 工作规范/        ├── 流程SOP/
│   └── 模板/
└── archive/            # 会话归档（按日期）
```

每个分类目录下有 `_INDEX.md` 目录页。知识条目命名：`YYYY-MM-DD-标题.md`。

## 知识卡片格式

每条知识使用统一模板（见 `conventions/模板/知识卡片模板.md`）：

```yaml
---
title: 标题
category: hr/招聘面试
tags: [招聘面试, AI工具]
source: 网页
date: 2026-05-28
status: 已整理
importance: ⭐⭐⭐
url: https://...
---
```

## 入库工具

### 入库工具（全功能版）
```bash
python ingest_hr.py --file "path"       # 文件入库
python ingest_hr.py --folder "path"     # 文件夹批量
python ingest_hr.py --url "URL"         # 网页/文章
python ingest_hr.py --url "URL" --local # 同步生成本地md
python ingest_hr.py --daemon            # 后台自动处理
python ingest_hr.py --sync              # 单次同步
```
- 飞书 Base：`TpoSbBr6QaXUDFs4abYcEJQEnUd` 表：`tblac5PrdBNBj8Nn`

### 知识库管理工具
```bash
python kb.py index              # 扫描本地md，重建总索引
python kb.py search "关键词"    # 本地+Base联合搜索
python kb.py stats              # 知识库统计
python kb.py review             # 今日待复习
python kb.py card "标题"        # 打印知识卡片
```

## 飞书 Base 总索引

统一的知识检索入口，字段：
- 标题、分类路径、标签、内容摘要、来源、原始链接、本地路径
- 状态（草稿/已整理/待复习/已归档）
- 创建日期、复习日期、重要程度（⭐⭐⭐/⭐⭐/⭐）

## 规范

- 所有产出物存 D 盘
- 知识条目必须有 frontmatter（标题、分类、标签、日期）
- 入库内容需有标题、来源、日期
- 定期回顾，保持知识库整洁
