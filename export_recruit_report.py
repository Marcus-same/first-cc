#!/usr/bin/env python
"""招聘看板静态报告导出工具

从飞书 Base 拉取全部招聘数据，生成自包含的静态 HTML 文件。
拿到 HTML 的同事直接双击打开即可查看，无需任何服务器。

用法:
    python export_recruit_report.py                     # 导出全部数据
    python export_recruit_report.py --out D:/报告.html   # 指定输出路径
    python export_recruit_report.py --date 2026-06-22   # 仅导出指定日期
"""

import json, os, shutil, subprocess, sys, time
from datetime import datetime
from pathlib import Path

# Fix Windows console encoding (emoji support)
if sys.platform == 'win32':
    import io
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

# ── Config ──────────────────────────────────────────────
BASE_TOKEN = "TpoSbBr6QaXUDFs4abYcEJQEnUd"
TABLE_FUNNEL = "tblcLfSJFhW3RP06"
TABLE_PROGRESS = "tbl7QQBWQui7i7eo"
TABLE_NOTES = "tbl3GtMqnBBGapGJ"
TABLE_CAMP = "tblp8E0NfUJJDKDE"

DEPTS = ["教研", "区域", "技术"]
STAGES = ["推荐", "邀约", "初试", "复试", "Offer", "入职"]
STAGE_KEYS = ["recommend", "invite", "first", "second", "offer", "onboard"]
SKEY_V2 = ["rec", "invite", "first", "second", "offer", "join"]

# ── lark-cli 封装 ──────────────────────────────────────
_NPM_DIR = os.path.join(os.environ.get("APPDATA", ""), "npm")
_LARK_RUN_JS = os.path.join(_NPM_DIR, "node_modules", "@larksuite", "cli", "scripts", "run.js")
_NODE_EXE = shutil.which("node")
if not _NODE_EXE:
    try:
        out = subprocess.run("where node", shell=True, capture_output=True, text=True, timeout=5,
                             creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        for line in out.stdout.strip().split("\n"):
            p = line.strip()
            if p and os.path.exists(p):
                _NODE_EXE = p
                break
    except Exception:
        pass
if not _NODE_EXE:
    _NODE_EXE = "node"


def _run_lark_cli(args: list[str], timeout: int = 30, max_retries: int = 2) -> dict:
    """直接调 Node.js 运行 lark-cli"""
    if not os.path.exists(_LARK_RUN_JS):
        return {"ok": False, "error": {"message": f"lark-cli run.js 未找到: {_LARK_RUN_JS}"}}
    full_cmd = [_NODE_EXE, _LARK_RUN_JS] + args
    last_err = None
    encoding_priority = ('utf-8', 'gbk', 'cp936') if sys.platform == 'win32' else ('utf-8', 'gbk', 'cp936')
    for attempt in range(max_retries + 1):
        try:
            result = subprocess.run(full_cmd, capture_output=True, timeout=timeout,
                                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
            for enc in encoding_priority:
                try:
                    output = result.stdout.decode(enc)
                    if output.strip():
                        return json.loads(output)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
            for enc in encoding_priority:
                try:
                    err_output = result.stderr.decode(enc)
                    if err_output.strip():
                        return json.loads(err_output)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
            last_err = f"Exit code {result.returncode}, no parseable output"
        except subprocess.TimeoutExpired:
            last_err = f"Timeout ({timeout}s)"
        except Exception as e:
            last_err = str(e)
        if attempt < max_retries:
            time.sleep(1)
    return {"ok": False, "error": {"message": last_err}}


def _parse_record_list(resp: dict) -> list[dict]:
    """将 lark-cli record-list columnar 格式解析为记录列表"""
    data = resp.get("data", {})
    if isinstance(data, list):
        return [{"id": r.get("id", ""), "fields": r.get("fields", r)} for r in data if isinstance(r, dict)]
    if not isinstance(data, dict):
        return []
    rows = data.get("data", [])
    field_names = data.get("fields", [])
    record_ids = data.get("record_id_list", [])
    records = []
    for i, row in enumerate(rows):
        if not isinstance(row, (list, tuple)):
            continue
        fields = {}
        for j, val in enumerate(row):
            if val is not None and j < len(field_names):
                name = field_names[j]
                if isinstance(val, list) and len(val) > 0:
                    fields[name] = val[0] if len(val) == 1 else val
                else:
                    fields[name] = val
        rid = record_ids[i] if i < len(record_ids) else ""
        rec = {"id": rid}
        if fields:
            rec["fields"] = fields
        records.append(rec)
    return records


def _base_list_all(table_id: str) -> list[dict]:
    """拉取 Base 表中全部记录"""
    resp = _run_lark_cli([
        "base", "+record-list",
        "--base-token", BASE_TOKEN,
        "--table-id", table_id,
        "--limit", "500",
        "--format", "json",
    ], timeout=30)
    return _parse_record_list(resp)


def _field_str(record: dict, field_name: str, default: str = "") -> str:
    val = record.get("fields", {}).get(field_name, default)
    if val is None:
        return default
    return str(val)


def _field_int(record: dict, field_name: str, default: int = 0) -> int:
    try:
        return int(_field_str(record, field_name))
    except (ValueError, TypeError):
        return default


def _field_date(record: dict, field_name: str, default: str = "") -> str:
    """安全获取日期字段，自动截取前10位（处理 datetime 格式）"""
    val = _field_str(record, field_name, default)
    if val:
        val = val.strip()[:10]  # "2026-06-16 00:00:00" -> "2026-06-16"
    return val


# ── 数据拉取 ────────────────────────────────────────────

def fetch_all_data():
    """从 Base 拉取全部数据"""
    print("📋 拉取招聘漏斗数据...")
    funnel_raw = _base_list_all(TABLE_FUNNEL)

    print("📋 拉取进度科目数据...")
    progress_raw = _base_list_all(TABLE_PROGRESS)

    print("📋 拉取备注数据...")
    notes_raw = _base_list_all(TABLE_NOTES)

    print("📋 拉取新人营数据(v2)...")
    camp_raw = _base_list_all(TABLE_CAMP)

    # ── 组织 funnel 数据 ──
    funnel_data = {}  # {date: {dept: {stage_key: count}}}
    for r in funnel_raw:
        d = _field_date(r, "日期")
        dept = _field_str(r, "部门")
        if not d or dept not in DEPTS:
            continue
        if d not in funnel_data:
            funnel_data[d] = {dept: {} for dept in DEPTS}
        for i, key in enumerate(STAGE_KEYS):
            funnel_data[d][dept][key] = _field_int(r, STAGES[i])

    # ── 组织 progress 数据 ──
    progress_data = {}  # {date: {dept: [{subject, needed, current}]}}
    for r in progress_raw:
        d = _field_date(r, "日期")
        dept = _field_str(r, "部门")
        raw = _field_str(r, "科目清单")
        if not d or dept not in DEPTS:
            continue
        if d not in progress_data:
            progress_data[d] = {dept: [] for dept in DEPTS}
        if raw:
            try:
                progress_data[d][dept] = json.loads(raw)
            except json.JSONDecodeError:
                progress_data[d][dept] = []

    # ── 组织 notes 数据 ──
    notes_data = {}  # {date: {content, fontColor, bgColor}}
    for r in notes_raw:
        d = _field_date(r, "日期")
        if not d:
            continue
        notes_data[d] = {
            "content": _field_str(r, "备注内容"),
            "fontColor": _field_str(r, "字体颜色", "#111111"),
            "bgColor": _field_str(r, "背景颜色", "#ffffff"),
            "editor": _field_str(r, "更新人"),
            "updatedAt": _field_str(r, "更新时间"),
        }

    # ── 组织 camp (v2) 数据 ──
    camp_entries = []  # [{date, 教研: {rec, invite, ...}, 区域: {...}, 技术: {...}}]
    for r in camp_raw:
        f = r.get("fields", {})
        d = _field_date(r, "日期")
        if not d:
            continue
        entry = {"date": d}
        for dept in DEPTS:
            entry[dept] = {}
            for i, key in enumerate(SKEY_V2):
                field_name = f"{dept}_{STAGES[i]}"
                entry[dept][key] = _field_int(r, field_name)
            jd = _field_str(r, f"{dept}_可入职日期")
            if jd and jd != "None":
                entry[dept]["joinDate"] = jd
        camp_entries.append(entry)
    camp_entries.sort(key=lambda e: e["date"])

    return {
        "funnel": funnel_data,
        "progress": progress_data,
        "notes": notes_data,
        "camp": camp_entries,
        "exportedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ── HTML 生成 ───────────────────────────────────────────

def generate_html(data: dict) -> str:
    """生成自包含 HTML 报告"""
    data_json = json.dumps(data, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>招聘数据看板 · {data['exportedAt'][:10]}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
:root{{--bg:#F9F8F5;--card:#fff;--border:#E0DCD3;--text:#111;--dim:#777;--gold:#B8860B;--gold-bg:#FFFBF0;--green:#3D7A4D;--green-bg:#F2F8F3;--blue:#3D6C8A;--blue-bg:#F0F4F8;--red:#C05050;--teach:#4a6cf7;--region:#10b981;--tech:#8b5cf6}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:12px 16px;-webkit-font-smoothing:antialiased}}
.db{{max-width:720px;margin:0 auto}}

/* tabs */
.tabs{{display:flex;gap:0;margin-bottom:12px;background:var(--card);border-radius:10px;padding:4px;border:1px solid var(--border)}}
.tab{{flex:1;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:none;color:var(--dim);border-radius:8px;transition:all .15s;font-family:inherit;text-align:center}}
.tab.active{{background:var(--gold);color:#fff;box-shadow:0 2px 8px rgba(184,134,11,.25)}}
.tab:hover:not(.active){{color:var(--text)}}

.topbar{{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px}}
.topbar h1{{font-size:17px;font-weight:700;letter-spacing:.02em}}
.topbar-right{{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:11px;color:var(--dim)}}
.export-badge{{background:var(--green-bg);color:var(--green);padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600}}

.datepick{{border:1px solid var(--border);border-radius:5px;padding:4px 8px;font-size:13px;background:#fff;color:var(--text);font-family:inherit;cursor:pointer;font-weight:700}}
.btn{{padding:4px 12px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:#fff;color:var(--text);transition:all .12s;font-family:inherit;white-space:nowrap}}
.btn:hover{{opacity:.85}}
.btn.primary{{background:var(--gold);color:#fff;border-color:var(--gold)}}

.card{{background:var(--card);border-radius:8px;border:1px solid var(--border);padding:14px 18px;margin-bottom:10px}}
.card-title{{font-size:14px;font-weight:800;margin-bottom:10px;padding-bottom:8px;display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--border);letter-spacing:.03em}}
.card-title::before{{content:'';display:inline-block;width:4px;height:18px;background:var(--gold);border-radius:2px;flex-shrink:0}}

/* funnel table */
.data-table{{width:100%;border-collapse:collapse;font-size:13px}}
.data-table th{{padding:7px 6px;text-align:center;font-weight:700;font-size:12px;color:#fff;background:#9A7008;border:none;white-space:nowrap;text-shadow:0 1px 1px rgba(0,0,0,0.15)}}
.data-table th:first-child{{border-radius:5px 0 0 5px}}
.data-table th:last-child{{border-radius:0 5px 5px 0}}
.data-table td{{padding:8px 6px;text-align:center;border-bottom:1px solid var(--border);font-size:14px}}
.data-table td:first-child{{font-weight:600;font-size:13px}}
.data-table .num{{font-weight:700;font-variant-numeric:tabular-nums;font-size:15px}}
.data-table .jy{{color:var(--gold)}}.data-table .qy{{color:var(--green)}}.data-table .js{{color:var(--blue)}}
.data-table .total-row td{{font-weight:700;background:var(--gold-bg);border-top:2px solid var(--border)}}
.data-table .zero{{color:#d1d5db}}

/* progress */
.progress-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--border);border-radius:6px;overflow:hidden}}
.progress-col{{display:flex;flex-direction:column;border-right:1px solid var(--border)}}
.progress-col:last-child{{border-right:none}}
.progress-col-hd{{text-align:center;font-size:13px;font-weight:700;color:#fff;padding:6px 0;flex-shrink:0}}
.progress-col-hd.jy{{background:#9A7008}}.progress-col-hd.qy{{background:#306A3D}}.progress-col-hd.js{{background:#2F5B76}}
.progress-col-bd{{padding:7px 12px;flex:1;display:flex;flex-direction:column;gap:2px}}
.progress-item{{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px}}
.progress-item .subject{{font-weight:600;flex-shrink:0;color:var(--text)}}
.progress-bar-wrap{{display:flex;align-items:center;gap:6px;flex-shrink:0}}
.progress-bar{{width:52px;height:6px;background:#ECEAE6;border-radius:3px;overflow:hidden}}
.progress-bar .fill{{height:100%;border-radius:3px;transition:width .3s}}
.fill.jy{{background:var(--gold)}}.fill.qy{{background:var(--green)}}.fill.js{{background:var(--blue)}}
.progress-val{{font-weight:700;font-size:12px;font-variant-numeric:tabular-nums;min-width:32px;text-align:right;color:var(--text)}}
.progress-empty{{text-align:center;color:var(--dim);font-size:12px;padding:12px 0;flex:1;display:flex;align-items:center;justify-content:center}}

/* notes */
.notes-content{{font-size:13px;line-height:1.7;white-space:pre-wrap;min-height:40px;padding:8px 10px;border-radius:5px}}

/* camp cards */
.camps{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}}
.camp{{border-radius:12px;padding:14px 16px;text-align:center}}
.camp.c1{{background:#fffbeb;border:1px solid #fde68a}}
.camp.c2{{background:#ecfeff;border:1px solid #a5f3fc}}
.camp .camp-date{{font-size:.7rem;color:var(--dim);margin-bottom:2px}}
.camp .camp-num{{font-size:2.4rem;font-weight:900;line-height:1.1}}
.camp .camp-label{{font-size:.7rem;color:var(--dim);margin-top:2px}}
.camp .camp-split{{display:flex;justify-content:center;gap:10px;margin-top:6px;font-size:.7rem;font-weight:700}}
.split-t{{color:var(--teach)}}.split-r{{color:var(--region)}}.split-x{{color:var(--tech)}}

/* v2 delivery table */
.delivery{{margin-bottom:14px}}
.delivery .sec-title{{font-size:.82rem;font-weight:700;margin-bottom:8px;color:var(--text)}}
.delivery table{{width:100%;border-collapse:collapse;font-size:.78rem}}
.delivery th{{font-weight:600;color:var(--dim);padding:4px 0;text-align:center;font-size:.7rem}}
.delivery th:first-child{{text-align:left;padding-left:6px}}
.delivery td{{padding:5px 0;text-align:center;font-weight:600}}
.delivery td:first-child{{text-align:left;font-weight:700;padding-left:6px}}
.delivery td.zero{{color:#d1d5db}}
.delivery tr.total-row td{{border-top:1px solid #e2e8f0;font-size:.78rem}}

/* funnel bars */
.funnel-block{{margin-bottom:14px}}
.funnel-block h3{{font-size:.85rem;margin-bottom:6px;display:flex;align-items:center;gap:6px}}
.funnel-block h3 .dot{{width:8px;height:8px;border-radius:50%;display:inline-block}}
.funnel-row{{display:flex;align-items:center;gap:8px;margin-bottom:4px}}
.funnel-row .flbl{{width:36px;font-size:.72rem;font-weight:600;text-align:right;color:var(--dim)}}
.funnel-row .fnum{{width:32px;font-size:.78rem;font-weight:700;text-align:right}}
.funnel-row .fbar{{flex:1;height:18px;background:#f1f5f9;border-radius:4px;overflow:hidden}}
.funnel-row .fbar .ff{{height:100%;border-radius:4px;transition:width .3s}}
.ff-t{{background:linear-gradient(90deg,#667eea,#764ba2)}}
.ff-r{{background:linear-gradient(90deg,#10b981,#34d399)}}
.ff-x{{background:linear-gradient(90deg,#8b5cf6,#a78bfa)}}

/* date summary list */
.date-list{{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}}
.date-chip{{padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:#fff;color:var(--dim);transition:all .12s;font-family:inherit}}
.date-chip.active{{background:var(--gold);color:#fff;border-color:var(--gold)}}
.date-chip:hover:not(.active){{border-color:var(--gold);color:var(--gold)}}

/* empty state */
.empty-state{{text-align:center;padding:40px 20px;color:var(--dim)}}
.empty-state .icon{{font-size:40px;margin-bottom:10px}}
.empty-state p{{font-size:13px}}

.ft{{text-align:center;font-size:10px;color:var(--dim);margin-top:14px;padding-bottom:12px;line-height:1.8}}
.ft a{{color:var(--gold);text-decoration:underline}}

@media(max-width:640px){{
  .progress-grid{{grid-template-columns:1fr;border:none}}.progress-col{{border-right:none;border-bottom:1px solid var(--border)}}
  .camps{{grid-template-columns:1fr}}
}}
@media print{{
  body{{background:#fff;padding:0}}
  .tabs,.topbar-right,.date-list,.ft{{display:none}}
  .card{{break-inside:avoid;border:none;padding:8px 0}}
  .card-title::before{{display:none}}
}}
</style>
</head>
<body>
<div class="db">

<!-- Tabs -->
<div class="tabs">
  <button class="tab active" onclick="switchView('daily')">📊 每日数据看板</button>
  <button class="tab" onclick="switchView('camp')">🏕️ 新人营日报</button>
</div>

<!-- Top Bar -->
<div class="topbar">
  <h1 id="viewTitle">📊 招聘数据看板</h1>
  <div class="topbar-right">
    <span class="export-badge">📅 {data['exportedAt']} 导出</span>
  </div>
</div>

<!-- ═══ VIEW 1: 每日看板 ═══ -->
<div id="view-daily">
  <div class="date-list" id="dateChips"></div>
  <div id="dailyContent"></div>
</div>

<!-- ═══ VIEW 2: 新人营日报 ═══ -->
<div id="view-camp" style="display:none">
  <div class="camps" id="campCards"></div>
  <div class="delivery" id="deliveryTable"></div>
  <h3 style="font-size:.85rem;margin:14px 0 8px">📊 招聘漏斗（累计）</h3>
  <div id="funnelContent"></div>
</div>

<div class="ft">
  招聘数据看板 · 静态报告 · 飞书 Base 数据源<br>
  数据导出时间：{data['exportedAt']} · 双击 HTML 即可查看
</div>

</div>

<script>
// ═══ 嵌入数据 ═══
const DATA = {data_json};

const DEPTS = ["教研","区域","技术"];
const STAGES = ["推荐","邀约","初试","复试","Offer","入职"];
const SKEYS = ["recommend","invite","first","second","offer","onboard"];
const SKEY_V2 = ["rec","invite","first","second","offer","join"];
const DEPT_COLORS = {{教研:"#B8860B",区域:"#3D7A4D",技术:"#3D6C8A"}};
const DEPT_CLASSES = {{教研:"jy",区域:"qy",技术:"js"}};
const DEPT_BARS = {{教研:"ff-t",区域:"ff-r",技术:"ff-x"}};
const C1='2026-06-22', C2='2026-07-20';

let currentView = 'daily';
let selectedDate = null;

// ── View Switch ──
function switchView(v) {{
  currentView = v;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.textContent.includes(v==='daily'?'每日':'新人营')));
  document.getElementById('view-daily').style.display = v==='daily'?'block':'none';
  document.getElementById('view-camp').style.display = v==='camp'?'block':'none';
  document.getElementById('viewTitle').textContent = v==='daily'?'📊 招聘数据看板':'🏕️ 新人营 · 招聘交付日报';
  if (v==='daily') renderDaily();
  if (v==='camp') renderCamp();
}}

// ═══════════ VIEW 1: 每日看板 ═══════════
function renderDaily() {{
  const dates = [...new Set([
    ...Object.keys(DATA.funnel||{{}}),
    ...Object.keys(DATA.progress||{{}}),
    ...Object.keys(DATA.notes||{{}})
  ])].sort().reverse();

  // date chips
  let chipHtml = '';
  dates.forEach(d => {{
    chipHtml += `<button class="date-chip${{d===selectedDate?' active':''}}" onclick="selectDate('${{d}}')">${{d.slice(5)}}</button>`;
  }});
  if (dates.length === 0) chipHtml = '<span style="font-size:11px;color:var(--dim)">暂无数据</span>';
  document.getElementById('dateChips').innerHTML = chipHtml;

  if (!selectedDate) selectedDate = dates[0] || '';
  if (!selectedDate) {{
    document.getElementById('dailyContent').innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无招聘数据</p></div>';
    return;
  }}

  // highlight selected
  document.querySelectorAll('.date-chip').forEach(c => c.classList.toggle('active', c.textContent === selectedDate.slice(5)));

  const funnel = (DATA.funnel||{{}})[selectedDate] || {{}};
  const progress = (DATA.progress||{{}})[selectedDate] || {{}};
  const notes = (DATA.notes||{{}})[selectedDate] || null;

  let html = '';

  // funnel table
  html += '<div class="card"><div class="card-title">部门数据 · '+selectedDate+'</div>';
  html += '<table class="data-table"><thead><tr><th>部门</th>'+STAGES.map(s=>'<th>'+s+'</th>').join('')+'</tr></thead><tbody>';

  let totals = SKEYS.map(()=>0);
  DEPTS.forEach(dept => {{
    const f = funnel[dept] || {{}};
    const vals = SKEYS.map(k => f[k] || 0);
    vals.forEach((v,i) => totals[i] += v);
    html += '<tr><td class="'+DEPT_CLASSES[dept]+'">'+dept+'</td>'+vals.map(v => '<td class="num'+(v===0?' zero':'')+'">'+v+'</td>').join('')+'</tr>';
  }});
  html += '<tr class="total-row"><td>合计</td>'+totals.map(v => '<td class="num">'+(v||'-')+'</td>').join('')+'</tr>';
  html += '</tbody></table></div>';

  // progress
  html += '<div class="card"><div class="card-title">累计进度</div>';
  html += '<div class="progress-grid">';
  DEPTS.forEach(dept => {{
    const items = progress[dept] || [];
    html += '<div class="progress-col"><div class="progress-col-hd '+DEPT_CLASSES[dept]+'">'+dept+'</div><div class="progress-col-bd">';
    if (items.length === 0) {{
      html += '<div class="progress-empty">暂无数据</div>';
    }} else {{
      items.forEach(it => {{
        const pct = it.needed > 0 ? Math.round((it.current/it.needed)*100) : 0;
        html += '<div class="progress-item"><span class="subject">'+(it.subject||'(空)')+'</span><div class="progress-bar-wrap"><div class="progress-bar"><div class="fill '+DEPT_CLASSES[dept]+'" style="width:'+pct+'%"></div></div><span class="progress-val">'+it.current+'/'+it.needed+'</span></div></div>';
      }});
    }}
    html += '</div></div>';
  }});
  html += '</div></div>';

  // notes
  if (notes) {{
    const fc = notes.fontColor || '#111111';
    const bc = notes.bgColor || '#ffffff';
    html += '<div class="card"><div class="card-title">备注</div>';
    html += '<div class="notes-content" style="color:'+fc+';background:'+bc+'">'+(notes.content || '(无备注)')+'</div>';
    if (notes.editor) html += '<div style="font-size:10px;color:var(--dim);margin-top:6px">更新人：'+notes.editor+' · '+ (notes.updatedAt || '') +'</div>';
    html += '</div>';
  }}

  document.getElementById('dailyContent').innerHTML = html;
}}

function selectDate(d) {{
  selectedDate = d;
  renderDaily();
}}

// ═══════════ VIEW 2: 新人营日报 ═══════════
function renderCamp() {{
  const entries = DATA.camp || [];

  if (entries.length === 0) {{
    document.getElementById('campCards').innerHTML = '<div class="empty-state"><div class="icon">🏕️</div><p>暂无新人营数据</p></div>';
    document.getElementById('deliveryTable').innerHTML = '';
    document.getElementById('funnelContent').innerHTML = '';
    return;
  }}

  // cumulative computation
  const cum = {{}};
  const p1 = {{}}, p2 = {{}};  // period 1 & 2
  DEPTS.forEach(b => {{
    cum[b] = {{}}; p1[b] = {{}}; p2[b] = {{}};
    SKEY_V2.forEach(k => {{ cum[b][k] = 0; p1[b][k] = 0; p2[b][k] = 0; }});
  }});

  entries.forEach(e => {{
    DEPTS.forEach(b => {{
      if (!e[b]) return;
      SKEY_V2.forEach(k => {{ cum[b][k] += (e[b][k] || 0); }});
      const jv = e[b].join || 0;
      if (jv > 0) {{
        const jd = e[b].joinDate || e.date;
        if (jd <= C1) {{ p1[b].join += jv; p1[b].offer += (e[b].offer || 0); }}
        else if (jd <= C2) {{ p2[b].join += jv; p2[b].offer += (e[b].offer || 0); }}
      }}
    }});
  }});

  // camp cards
  const today = new Date().toISOString().slice(0,10);
  const d1 = Math.ceil((new Date(C1) - new Date())/864e5);
  const d2 = Math.ceil((new Date(C2) - new Date())/864e5);

  let cardsHtml = '';
  [{{id:'c1',date:C1,days:d1,p:p1,cls:'c1'}},{{id:'c2',date:C2,days:d2,p:p2,cls:'c2'}}].forEach(camp => {{
    const j = DEPTS.map(b => camp.p[b].join || 0);
    const o = DEPTS.map(b => camp.p[b].offer || 0);
    const tj = j.reduce((a,b)=>a+b,0);
    const to = o.reduce((a,b)=>a+b,0);
    const ds = camp.days > 0 ? '距开营 <b>'+camp.days+'</b> 天' : camp.days === 0 ? '今天开营' : '已开营';
    cardsHtml += '<div class="camp '+camp.cls+'">'+
      '<div class="camp-date">'+camp.date+' · '+ds+'</div>'+
      '<div class="camp-num">'+tj+'<span style="font-size:.75rem;font-weight:500;color:#94a3b8;">人</span></div>'+
      '<div class="camp-label">可参加（Offer '+to+'人）</div>'+
      '<div class="camp-split">'+
        '<span class="split-t">教研 '+j[0]+'</span>'+
        '<span class="split-r">区域 '+j[1]+'</span>'+
        '<span class="split-x">技术 '+j[2]+'</span>'+
      '</div></div>';
  }});
  document.getElementById('campCards').innerHTML = cardsHtml;

  // delivery table
  let thtml = '<div class="sec-title">累计交付进度</div><table><thead><tr><th></th>'+STAGES.map(s=>'<th>'+s+'</th>').join('')+'</tr></thead><tbody>';
  DEPTS.forEach(b => {{
    thtml += '<tr><td style="color:'+DEPT_COLORS[b]+'">'+b+'</td>';
    STAGES.forEach((_,i) => {{
      const v = cum[b][SKEY_V2[i]];
      thtml += '<td'+(v===0?' class="zero"':'')+'>'+v+'</td>';
    }});
    thtml += '</tr>';
  }});
  thtml += '<tr class="total-row"><td>合计</td>';
  STAGES.forEach((_,i) => {{
    const sum = DEPTS.reduce((a,b) => a+(cum[b][SKEY_V2[i]]||0),0);
    thtml += '<td>'+(sum||'-')+'</td>';
  }});
  thtml += '</tr></tbody></table>';
  document.getElementById('deliveryTable').innerHTML = thtml;

  // funnel bars
  const allVals = DEPTS.flatMap(b => STAGES.map((_,i) => cum[b][SKEY_V2[i]]));
  const max = Math.max(...allVals, 1);

  let fhtml = '';
  DEPTS.forEach(b => {{
    fhtml += '<div class="funnel-block"><h3><span class="dot" style="background:'+DEPT_COLORS[b]+'"></span>'+b+'</h3>';
    STAGES.forEach((s,i) => {{
      const v = cum[b][SKEY_V2[i]];
      const pct = Math.round(v/max*100);
      fhtml += '<div class="funnel-row"><span class="flbl">'+s+'</span><span class="fnum">'+v+'</span><span style="font-size:.68rem;color:#cbd5e1;">人</span><div class="fbar"><div class="ff '+DEPT_BARS[b]+'" style="width:'+pct+'%"></div></div></div>';
    }});
    fhtml += '</div>';
  }});
  document.getElementById('funnelContent').innerHTML = fhtml;
}}

// ── Init ──
(function() {{
  const dates = [...new Set([
    ...Object.keys(DATA.funnel||{{}}),
    ...Object.keys(DATA.progress||{{}}),
    ...Object.keys(DATA.notes||{{}})
  ])].sort().reverse();
  selectedDate = dates[0] || null;
  renderDaily();
}})();
</script>
</body>
</html>"""


# ── Main ─────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="招聘看板静态报告导出")
    parser.add_argument("--out", type=str, default=None, help="输出文件路径")
    parser.add_argument("--date", type=str, default=None, help="仅导出指定日期（格式 YYYY-MM-DD）")
    args = parser.parse_args()

    print("=" * 50)
    print("📋 招聘看板静态报告导出")
    print("=" * 50)

    # 拉取数据
    all_data = fetch_all_data()

    # 如果指定了日期，只保留该日期的数据
    if args.date:
        d = args.date
        all_data["funnel"] = {d: all_data["funnel"].get(d, {})} if d in all_data["funnel"] else {}
        all_data["progress"] = {d: all_data["progress"].get(d, {})} if d in all_data["progress"] else {}
        all_data["notes"] = {d: all_data["notes"].get(d, {})} if d in all_data["notes"] else {}
        all_data["camp"] = [e for e in all_data["camp"] if e["date"] == d]
        print(f"\n📅 筛选日期: {d}")

    # 统计
    funnel_dates = len(all_data["funnel"])
    camp_dates = len(all_data["camp"])
    print(f"\n📊 数据统计:")
    print(f"   漏斗数据: {funnel_dates} 天")
    print(f"   新人营数据: {camp_dates} 天")
    print(f"   备注: {len(all_data['notes'])} 条")

    # 生成 HTML
    print("\n📝 生成 HTML 报告...")
    html = generate_html(all_data)

    # 输出路径
    if args.out:
        out_path = args.out
    else:
        date_tag = args.date if args.date else datetime.now().strftime("%Y-%m-%d")
        out_path = f"D:/招聘看板_{date_tag}.html"

    Path(out_path).write_text(html, encoding="utf-8")

    file_size_kb = Path(out_path).stat().st_size / 1024
    print(f"\n✅ 报告已生成: {out_path}")
    print(f"   文件大小: {file_size_kb:.1f} KB")
    print(f"\n💡 将此 HTML 文件通过飞书/邮件发送给同事，对方双击即可查看。")
    print(f"   如需更新数据，重新运行: python export_recruit_report.py")

    # 尝试打开
    if sys.platform == 'win32':
        os.startfile(out_path)


if __name__ == "__main__":
    main()
