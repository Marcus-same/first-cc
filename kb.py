"""
知识库管理工具 — 一键入库 + 本地检索 + 飞书 Base 同步

用法:
  python kb.py add --url "https://..."      一键入库（网页）
  python kb.py add --file "path/doc.pdf"     一键入库（文件）
  python kb.py add --text "内容..."          一键入库（文字）
  python kb.py search "关键词"               本地+飞书联合搜索
  python kb.py stats                         知识库全景统计
  python kb.py review                        今日待复习
  python kb.py card "标题"                   终端打印知识卡片
"""

import argparse, json, os, re, subprocess, sys, time
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

KB_ROOT = Path(__file__).parent / "knowledge-base"

INDEX_BASE_TOKEN = "TpoSbBr6QaXUDFs4abYcEJQEnUd"
INDEX_TABLE_ID = "tblZM9cbdh9CVRkm"
HR_BASE_TOKEN = "TpoSbBr6QaXUDFs4abYcEJQEnUd"
HR_TABLE_ID = "tblac5PrdBNBj8Nn"

SKIP_DIRS = {"archive", ".git", "__pycache__", "node_modules"}

TAG_TO_DIR = {
    # HR
    "招聘面试": "hr/招聘面试", "培训发展": "hr/培训发展",
    "薪酬绩效": "hr/薪酬绩效", "员工关系": "hr/员工关系",
    "组织发展": "hr/组织发展", "劳动法务": "hr/劳动法务",
    # 成长
    "沟通表达": "growth/沟通表达", "职业规划": "growth/职业规划",
    "职场关系": "growth/职场关系",
    # 技术
    "编程开发": "tech/编程开发", "产品设计": "tech/产品设计",
    "AI工具": "tools/AI工具", "Prompt技巧": "tools/AI工具",
    "技术架构": "tech/编程开发", "设计灵感": "tech/产品设计",
    # 工具
    "自动化": "tools/自动化脚本", "效率工具": "tools/办公技能",
    "办公技能": "tools/办公技能", "数据分析": "tech/编程开发",
    # 阅读 & 生活
    "读书笔记": "reading/读书笔记", "创业商业": "life/生活思考",
    "生活思考": "life/生活思考", "健康": "life/生活思考",
}


def _run_lark(args: list[str], timeout: int = 30) -> dict:
    npm_dir = os.path.join(os.environ.get("APPDATA", ""), "npm")
    run_js = os.path.join(npm_dir, "node_modules", "@larksuite", "cli", "scripts", "run.js")
    if not os.path.exists(run_js):
        return {"ok": False, "error": {"message": f"lark-cli not found: {run_js}"}}
    full_cmd = ["node", run_js] + args
    encs = ('gbk', 'cp936', 'utf-8') if sys.platform == 'win32' else ('utf-8',)
    for attempt in range(2):
        try:
            r = subprocess.run(full_cmd, capture_output=True, timeout=timeout)
            for enc in encs:
                try:
                    out = r.stdout.decode(enc)
                    if out.strip():
                        return json.loads(out)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
            for enc in encs:
                try:
                    out = r.stderr.decode(enc)
                    if out.strip():
                        return json.loads(out)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
        except subprocess.TimeoutExpired:
            pass
        except Exception:
            pass
        if attempt < 1:
            time.sleep(1)
    return {"ok": False, "error": {"message": "lark-cli failed"}}


# ============================================================
# AI 分析 (从 ingest_hr 导入)
# ============================================================
def _get_deepseek():
    import importlib.util
    spec = importlib.util.spec_from_file_location("ingest_hr", Path(__file__).parent / "ingest_hr.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

_ingest = None

def _get_ingest():
    global _ingest
    if _ingest is None:
        _ingest = _get_deepseek()
    return _ingest


def _ai_analyze(content: str) -> dict:
    """调用 DeepSeek 分析内容 → 标题/摘要/标签"""
    m = _get_ingest()
    return m.analyze_hr_content(content)


def _extract_content(source_type: str, source_path: str) -> tuple[str, str]:
    """提取内容，返回 (text, url_link)"""
    m = _get_ingest()
    if source_type == "file":
        text = m.extract_text(source_path)
        return text, ""
    elif source_type == "url":
        text = m.fetch_web_content(source_path)
        return text, source_path
    else:
        return source_path, ""


# ============================================================
# 本地文件读写
# ============================================================
def parse_frontmatter(filepath: Path) -> dict | None:
    try:
        text = filepath.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        try:
            text = filepath.read_text(encoding='gbk')
        except Exception:
            return None
    if not text.startswith('---'):
        return None
    idx = text.find('---', 3)
    if idx < 0:
        return None
    fm_text = text[3:idx].strip()
    data = {}
    for line in fm_text.splitlines():
        if ':' not in line:
            continue
        key, _, val = line.partition(':')
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if val.startswith('[') and val.endswith(']'):
            val = [v.strip().strip('"').strip("'") for v in val[1:-1].split(',') if v.strip()]
        data[key] = val
    return data if data else None


def scan_kb() -> list[dict]:
    entries = []
    for root, dirs, files in os.walk(KB_ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        for f in files:
            if not f.endswith('.md') or f == '_INDEX.md':
                continue
            fp = Path(root) / f
            fm = parse_frontmatter(fp)
            if not fm:
                continue
            rel = fp.relative_to(KB_ROOT)
            fm['_file'] = str(rel)
            fm['_path'] = str(fp)
            fm['_mtime'] = datetime.fromtimestamp(fp.stat().st_mtime).strftime('%Y-%m-%d')
            entries.append(fm)
    return entries


def infer_category(tags: list[str]) -> str:
    for tag in tags:
        if tag in TAG_TO_DIR:
            return TAG_TO_DIR[tag]
    return ""


def write_local(title: str, category: str, tags: list[str], source: str,
                content: str, url: str) -> str:
    date = datetime.now().strftime("%Y-%m-%d")
    safe = re.sub(r'[<>:"/\\|?*]', '-', title)[:40]
    filename = f"{date}-{safe}.md"
    dir_path = KB_ROOT / category
    dir_path.mkdir(parents=True, exist_ok=True)
    filepath = dir_path / filename

    tags_str = ", ".join(tags) if tags else ""
    fm = f"""---
title: {title}
category: {category}
tags: [{tags_str}]
source: {source}
date: {date}
status: 已整理
importance: ⭐⭐
url: {url}
---

# {title}

## 一句话总结

<用一句话概括核心内容，不超过50字>

## 关键内容

{content}

## 我的思考

<个人批注、行动计划、关联其他知识>

## 相关链接

"""
    filepath.write_text(fm, encoding='utf-8')
    return str(filepath.relative_to(KB_ROOT))


def write_to_base(title: str, category: str, tags: list[str], summary: str,
                  source: str, url: str, local_path: str) -> bool:
    record = {
        "标题": title[:100],
        "分类路径": category[:100],
        "标签": tags[:5],
        "内容摘要": summary[:500],
        "来源": source,
        "原始链接": url[:500] if url else "",
        "本地路径": local_path,
        "状态": "已整理",
        "创建日期": datetime.now().strftime("%Y-%m-%d"),
        "重要程度": "⭐⭐",
    }
    body = json.dumps(record, ensure_ascii=False)
    resp = _run_lark([
        "--as", "user", "base", "+record-upsert",
        "--base-token", INDEX_BASE_TOKEN, "--table-id", INDEX_TABLE_ID,
        "--json", body,
    ])
    return resp.get("ok", False)


def write_to_hr_base(title: str, source: str, url: str, content: str, tags: list[str]) -> bool:
    """同时写入 HR 知识库表"""
    record = {
        "标题": title,
        "来源": source,
        "整理内容": content[:60000],
        "状态": "已完成",
    }
    if url:
        record["原始链接"] = url
    if tags:
        record["标签"] = tags[:3]

    body = json.dumps(record, ensure_ascii=False)
    if len(body) > 7500:
        record["整理内容"] = content[:3000]
        body = json.dumps(record, ensure_ascii=False)

    resp = _run_lark([
        "--as", "user", "base", "+record-upsert",
        "--base-token", HR_BASE_TOKEN, "--table-id", HR_TABLE_ID,
        "--json", body,
    ])
    return resp.get("ok", False)


# ============================================================
# 命令
# ============================================================
def cmd_add(source_type: str, source_path: str):
    """一键入库：提取 → AI分析 → 本地md → Base"""
    print("📥 提取内容...")
    try:
        text, url = _extract_content(source_type, source_path)
    except Exception as e:
        print(f"❌ 提取失败: {e}")
        return

    if not text or not text.strip():
        print("❌ 内容为空")
        return

    print(f"   📊 {len(text)} 字符")

    # 截断过长内容
    if len(text) > 8000:
        text = text[:8000]

    print("🤖 AI 分析...")
    try:
        result = _ai_analyze(text)
    except Exception as e:
        print(f"❌ AI 分析失败: {e}")
        return

    title = result.get("title", "未命名")
    tags = result.get("tags", [])
    content = result.get("organized_content", text[:500])
    source_label = result.get("source_type",
        "网页提取" if source_type == "url" else "本地文件" if source_type == "file" else "手动录入")

    # 推断分类
    category = infer_category(tags)
    if not category:
        category = "reading/读书笔记"  # 兜底

    print(f"\n{'─'*50}")
    print(f"  📌 {title}")
    print(f"  📂 {category}")
    print(f"  🏷  {', '.join(tags)}")
    print(f"  📝 {content[:150]}...")
    print(f"{'─'*50}")

    # 写入本地
    print("\n💾 写入本地...")
    try:
        local_path = write_local(title, category, tags, source_label, content, url)
        print(f"  ✅ {local_path}")
    except Exception as e:
        print(f"  ⚠️ 本地写入失败: {e}")
        local_path = ""

    # 写入 Base 总索引
    print("☁️  写入飞书 Base 总索引...")
    if write_to_base(title, category, tags, content[:200], source_label, url, local_path):
        print("  ✅ 总索引")
    else:
        print("  ⚠️ 总索引写入失败")

    # 同时写 HR 知识库
    print("☁️  写入飞书 HR 知识库...")
    if write_to_hr_base(title, source_label, url, content, tags):
        print("  ✅ HR知识库")
    else:
        print("  ⚠️ HR知识库写入失败")

    print(f"\n✅ 入库完成: {title}")
    print(f"   飞书: https://bytedance.feishu.cn/base/{INDEX_BASE_TOKEN}?table={INDEX_TABLE_ID}")


def cmd_search(keyword: str):
    results = []
    for root, dirs, files in os.walk(KB_ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        for f in files:
            if not f.endswith('.md'):
                continue
            fp = Path(root) / f
            try:
                t = fp.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                try:
                    t = fp.read_text(encoding='gbk')
                except Exception:
                    continue
            if keyword.lower() in t.lower():
                fm = parse_frontmatter(fp)
                rel = fp.relative_to(KB_ROOT)
                results.append({
                    'title': fm.get('title', f) if fm else f,
                    'file': str(rel),
                    'category': fm.get('category', '') if fm else '',
                })

    print(f"🔍 「{keyword}」— 本地 {len(results)} 条\n")
    for r in results:
        print(f"  [{r['category']}] {r['title']}")
        print(f"  📄 {r['file']}\n")


def cmd_stats():
    entries = scan_kb()
    cats = {}
    for e in entries:
        cat = e.get('category', '未分类')
        cats[cat] = cats.get(cat, 0) + 1

    print(f"📊 知识库全景\n")
    print(f"  总条目: {len(entries)}\n")
    print(f"  📂 分类分布:")
    for k, v in sorted(cats.items(), key=lambda x: -x[1]):
        bar = '█' * min(v, 20)
        print(f"     {k:25s} {v:3d}  {bar}")

    all_md = sum(1 for _ in KB_ROOT.rglob("*.md") if _.parent.name not in SKIP_DIRS)
    print(f"\n  📄 本地 md 文件: {all_md}")
    print(f"  📇 含知识卡片: {len(entries)}")


def cmd_review():
    today = datetime.now().strftime('%Y-%m-%d')
    entries = scan_kb()
    due = [e for e in entries
           if e.get('review_date', '') and e['review_date'] <= today
           and e.get('status') != '已归档']

    print(f"📖 {today} 待复习\n")
    if not due:
        print("  ✅ 暂无待复习")
        return
    for e in sorted(due, key=lambda x: x.get('review_date', '')):
        rd = e.get('review_date', '')
        flag = ' ⚠️逾期' if rd < today else ''
        print(f"  [{e.get('category', '')}] {e.get('title', '?')}")
        print(f"  📅 {rd}{flag}  ⭐ {e.get('importance', '')}  📄 {e.get('_file', '')}\n")
    print(f"  共 {len(due)} 条")


def cmd_card(title: str):
    entries = scan_kb()
    matches = [e for e in entries if title.lower() in (e.get('title', '')).lower()]
    if not matches:
        print(f"❌ 未找到「{title}」")
        return
    e = matches[0]
    w = 56
    print("╔" + "═"*w + "╗")
    print(f"║  📇 {e.get('title', '?')[:w-5]:<{w-4}s} ║")
    print("╠" + "═"*w + "╣")
    for label, key in [("分类", "category"), ("标签", "tags"), ("状态", "status"),
                        ("重要", "importance"), ("日期", "date"), ("来源", "source")]:
        val = e.get(key, '')
        if isinstance(val, list):
            val = ', '.join(val)
        if val:
            print(f"║  {label}: {str(val)[:w-7]:<{w-6}s} ║")
    print("╠" + "═"*w + "╣")
    try:
        fp = Path(e.get('_path', ''))
        if fp.exists():
            body = fp.read_text(encoding='utf-8')
            idx = body.find('---', 3)
            if idx > 0:
                for line in body[idx+3:].splitlines()[:15]:
                    print(f"║  {line[:w-4]:<{w-3}s} ║")
    except Exception:
        pass
    print("╚" + "═"*w + "╝")
    print(f"  📄 {e.get('_file', '')}")


# ============================================================
# CLI
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="知识库管理工具 · 一键入库 + 检索")
    sub = parser.add_subparsers(dest="command")

    p_add = sub.add_parser("add", help="一键入库")
    g = p_add.add_mutually_exclusive_group(required=True)
    g.add_argument("--url", help="网页链接")
    g.add_argument("--file", help="本地文件路径")
    g.add_argument("--text", help="直接输入文字")

    sub.add_parser("stats", help="知识库全景统计")
    p_search = sub.add_parser("search", help="搜索知识库")
    p_search.add_argument("keyword", help="搜索关键词")
    sub.add_parser("review", help="今日待复习")
    p_card = sub.add_parser("card", help="打印知识卡片")
    p_card.add_argument("title", help="卡片标题关键词")

    args = parser.parse_args()

    if args.command == "add":
        stype = "url" if args.url else "file" if args.file else "text"
        spath = args.url or args.file or args.text
        cmd_add(stype, spath)
    elif args.command == "search":
        cmd_search(args.keyword)
    elif args.command == "stats":
        cmd_stats()
    elif args.command == "review":
        cmd_review()
    elif args.command == "card":
        cmd_card(args.title)
    else:
        # 默认显示统计
        cmd_stats()


if __name__ == "__main__":
    main()
