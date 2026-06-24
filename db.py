"""SQLite 数据库层 — 极速读写（替代飞书 Base API）"""
import json, os, sqlite3, threading, time
from datetime import datetime
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_DIR", str(Path(__file__).parent))) / "recruit_data.db"

# 线程安全
_local = threading.local()

# 部门 / 阶段常量
DEPTS = ["教研", "区域", "技术"]
STAGES = ["推荐", "邀约", "初试", "复试", "Offer", "入职"]
STAGE_KEYS = ["recommend", "invite", "first", "second", "offer", "onboard"]


def get_db() -> sqlite3.Connection:
    """获取线程本地数据库连接"""
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(str(DB_PATH))
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA synchronous=NORMAL")
    return _local.conn


def init_db():
    """初始化数据库表"""
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS funnel (
            date TEXT NOT NULL,
            dept TEXT NOT NULL,
            recommend INTEGER DEFAULT 0,
            invite INTEGER DEFAULT 0,
            first INTEGER DEFAULT 0,
            second INTEGER DEFAULT 0,
            offer INTEGER DEFAULT 0,
            onboard INTEGER DEFAULT 0,
            editor TEXT DEFAULT '',
            updated_at TEXT DEFAULT '',
            PRIMARY KEY (date, dept)
        );
        CREATE TABLE IF NOT EXISTS progress (
            date TEXT NOT NULL,
            dept TEXT NOT NULL,
            items TEXT DEFAULT '[]',
            editor TEXT DEFAULT '',
            updated_at TEXT DEFAULT '',
            PRIMARY KEY (date, dept)
        );
        CREATE TABLE IF NOT EXISTS notes (
            date TEXT PRIMARY KEY,
            content TEXT DEFAULT '',
            font_color TEXT DEFAULT '#111111',
            bg_color TEXT DEFAULT '#ffffff',
            editor TEXT DEFAULT '',
            updated_at TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS camp (
            date TEXT PRIMARY KEY,
            data_json TEXT DEFAULT '{}',
            editor TEXT DEFAULT '',
            updated_at TEXT DEFAULT ''
        );
    """)
    db.commit()


# ── Funnel ────────────────────────────────────────

def funnel_get(date: str) -> dict:
    """获取某天的漏斗数据"""
    db = get_db()
    rows = db.execute("SELECT * FROM funnel WHERE date = ?", (date,)).fetchall()
    result = {}
    for r in rows:
        dept = r["dept"]
        result[dept] = {k: r[k] for k in STAGE_KEYS}
    # 填充默认值
    for dept in DEPTS:
        if dept not in result:
            result[dept] = {k: 0 for k in STAGE_KEYS}
    return result


def funnel_upsert(date: str, dept: str, data: dict, editor: str = ""):
    """保存一个部门的漏斗数据"""
    db = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.execute("""
        INSERT INTO funnel (date, dept, recommend, invite, first, second, offer, onboard, editor, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, dept) DO UPDATE SET
            recommend=excluded.recommend, invite=excluded.invite,
            first=excluded.first, second=excluded.second,
            offer=excluded.offer, onboard=excluded.onboard,
            editor=excluded.editor, updated_at=excluded.updated_at
    """, (date, dept, data.get("recommend", 0), data.get("invite", 0),
          data.get("first", 0), data.get("second", 0),
          data.get("offer", 0), data.get("onboard", 0),
          editor, now))
    db.commit()


def funnel_get_all_dates() -> set:
    """获取所有有数据的日期"""
    db = get_db()
    rows = db.execute("SELECT DISTINCT date FROM funnel").fetchall()
    return {r["date"] for r in rows}


# ── Progress ──────────────────────────────────────

def progress_get(date: str) -> dict:
    """获取某天的进度数据"""
    db = get_db()
    rows = db.execute("SELECT * FROM progress WHERE date = ?", (date,)).fetchall()
    result = {}
    for r in rows:
        try:
            result[r["dept"]] = json.loads(r["items"])
        except json.JSONDecodeError:
            result[r["dept"]] = []
    for dept in DEPTS:
        if dept not in result:
            result[dept] = []
    return result


def progress_upsert(date: str, dept: str, items: list, editor: str = ""):
    """保存一个部门的进度数据"""
    db = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    items_str = json.dumps(items, ensure_ascii=False)
    db.execute("""
        INSERT INTO progress (date, dept, items, editor, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date, dept) DO UPDATE SET
            items=excluded.items, editor=excluded.editor, updated_at=excluded.updated_at
    """, (date, dept, items_str, editor, now))
    db.commit()


# ── Notes ─────────────────────────────────────────

def notes_get(date: str) -> dict:
    """获取某天的备注"""
    db = get_db()
    r = db.execute("SELECT * FROM notes WHERE date = ?", (date,)).fetchone()
    if r:
        return {
            "content": r["content"], "fontColor": r["font_color"],
            "bgColor": r["bg_color"], "editor": r["editor"],
            "updatedAt": r["updated_at"],
        }
    return {"content": "", "fontColor": "#111111", "bgColor": "#ffffff"}


def notes_upsert(date: str, content: str, font_color: str = "#111111",
                  bg_color: str = "#ffffff", editor: str = ""):
    """保存备注"""
    db = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.execute("""
        INSERT INTO notes (date, content, font_color, bg_color, editor, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
            content=excluded.content, font_color=excluded.font_color,
            bg_color=excluded.bg_color, editor=excluded.editor,
            updated_at=excluded.updated_at
    """, (date, content, font_color, bg_color, editor, now))
    db.commit()


# ── Camp (v2) ─────────────────────────────────────

def camp_get_all() -> list:
    """获取全部新人营数据"""
    db = get_db()
    rows = db.execute("SELECT * FROM camp ORDER BY date").fetchall()
    entries = []
    for r in rows:
        try:
            entry = json.loads(r["data_json"])
            entry["date"] = r["date"]
            entries.append(entry)
        except json.JSONDecodeError:
            pass
    return entries


def camp_upsert(date: str, entry: dict, editor: str = ""):
    """保存新人营数据"""
    db = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data_json = json.dumps({k: v for k, v in entry.items() if k != "date"}, ensure_ascii=False)
    db.execute("""
        INSERT INTO camp (date, data_json, editor, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
            data_json=excluded.data_json, editor=excluded.editor,
            updated_at=excluded.updated_at
    """, (date, data_json, editor, now))
    db.commit()


# ── Export ────────────────────────────────────────

def export_all() -> dict:
    """导出全部数据"""
    db = get_db()
    result = {}
    all_dates = set()

    # Funnel
    for r in db.execute("SELECT * FROM funnel").fetchall():
        d = r["date"]
        all_dates.add(d)
        if d not in result:
            result[d] = {"funnel": {}, "progress": {}, "notes": ""}
        dept = r["dept"]
        result[d]["funnel"][dept] = {k: r[k] for k in STAGE_KEYS}

    # Progress
    for r in db.execute("SELECT * FROM progress").fetchall():
        d = r["date"]
        all_dates.add(d)
        if d not in result:
            result[d] = {"funnel": {}, "progress": {}, "notes": ""}
        try:
            result[d]["progress"][r["dept"]] = json.loads(r["items"])
        except json.JSONDecodeError:
            result[d]["progress"][r["dept"]] = []

    # Notes
    for r in db.execute("SELECT * FROM notes").fetchall():
        d = r["date"]
        all_dates.add(d)
        if d not in result:
            result[d] = {"funnel": {}, "progress": {}, "notes": ""}
        result[d]["notes"] = r["content"]

    # Fill defaults
    for d in result:
        if not result[d]["funnel"]:
            result[d]["funnel"] = {dept: {k: 0 for k in STAGE_KEYS} for dept in DEPTS}
        if not result[d]["progress"]:
            result[d]["progress"] = {dept: [] for dept in DEPTS}

    return result


def migrate_from_base(funnel_data: dict, progress_data: dict, notes_data: dict):
    """从飞书 Base 迁移数据到 SQLite"""
    db = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for date_str, depts in funnel_data.items():
        for dept, data in depts.items():
            db.execute("""
                INSERT OR REPLACE INTO funnel (date, dept, recommend, invite, first, second, offer, onboard, editor, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, '数据迁移', ?)
            """, (date_str, dept, data.get("recommend", 0), data.get("invite", 0),
                  data.get("first", 0), data.get("second", 0),
                  data.get("offer", 0), data.get("onboard", 0), now))

    for date_str, depts in progress_data.items():
        for dept, items in depts.items():
            db.execute("""
                INSERT OR REPLACE INTO progress (date, dept, items, editor, updated_at)
                VALUES (?, ?, ?, '数据迁移', ?)
            """, (date_str, dept, json.dumps(items, ensure_ascii=False), now))

    for date_str, note in notes_data.items():
        content = note.get("content", "") if isinstance(note, dict) else str(note)
        fc = note.get("fontColor", "#111111") if isinstance(note, dict) else "#111111"
        bg = note.get("bgColor", "#ffffff") if isinstance(note, dict) else "#ffffff"
        db.execute("""
            INSERT OR REPLACE INTO notes (date, content, font_color, bg_color, editor, updated_at)
            VALUES (?, ?, ?, ?, '数据迁移', ?)
        """, (date_str, content, fc, bg, now))

    db.commit()
    print(f"迁移完成: {len(funnel_data)} 天漏斗, {len(progress_data)} 天进度, {len(notes_data)} 天备注")


# ── 自动迁移 ──────────────────────────────────────

def auto_migrate():
    """如果 SQLite 为空，自动从飞书 Base 拉数据"""
    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM funnel").fetchone()[0]
    if count > 0:
        return  # 已有数据

    print("📋 SQLite 为空，从飞书 Base 迁移数据...")
    try:
        import feishu_api as feishu

        # 拉取 funnel
        funnel_raw = feishu.bitable_list_records("TpoSbBr6QaXUDFs4abYcEJQEnUd", "tblcLfSJFhW3RP06")
        funnel_data = {}
        for item in funnel_raw:
            parsed = feishu.parse_bitable_record(item)
            f = parsed["fields"]
            d = _field_date(f, "日期")
            dept = str(f.get("部门", ""))
            if d and dept:
                if d not in funnel_data:
                    funnel_data[d] = {}
                funnel_data[d][dept] = {}
                for i, k in enumerate(STAGE_KEYS):
                    funnel_data[d][dept][k] = _field_int(f, STAGES[i])

        # 拉取 progress
        progress_raw = feishu.bitable_list_records("TpoSbBr6QaXUDFs4abYcEJQEnUd", "tbl7QQBWQui7i7eo")
        progress_data = {}
        for item in progress_raw:
            parsed = feishu.parse_bitable_record(item)
            f = parsed["fields"]
            d = _field_date(f, "日期")
            dept = str(f.get("部门", ""))
            raw = str(f.get("科目清单", ""))
            if d and dept and raw:
                if d not in progress_data:
                    progress_data[d] = {}
                try:
                    progress_data[d][dept] = json.loads(raw)
                except json.JSONDecodeError:
                    progress_data[d][dept] = []

        # 拉取 notes
        notes_raw = feishu.bitable_list_records("TpoSbBr6QaXUDFs4abYcEJQEnUd", "tbl3GtMqnBBGapGJ")
        notes_data = {}
        for item in notes_raw:
            parsed = feishu.parse_bitable_record(item)
            f = parsed["fields"]
            d = _field_date(f, "日期")
            if d:
                notes_data[d] = {
                    "content": str(f.get("备注内容", "")),
                    "fontColor": str(f.get("字体颜色", "#111111")),
                    "bgColor": str(f.get("背景颜色", "#ffffff")),
                }

        migrate_from_base(funnel_data, progress_data, notes_data)
        print(f"  ✅ 迁移: {len(funnel_data)} 天漏斗, {len(progress_data)} 天进度, {len(notes_data)} 天备注")
    except Exception as e:
        print(f"  ⚠️ 迁移失败（可忽略，手动录入即可）: {e}")


def _field_date(fields: dict, name: str, default: str = "") -> str:
    val = fields.get(name, default)
    if val is None:
        return default
    if isinstance(val, (int, float)) and val > 1000000000000:
        return datetime.fromtimestamp(val / 1000).strftime("%Y-%m-%d")
    return str(val).strip()[:10] if val else default


def _field_int(fields: dict, name: str, default: int = 0) -> int:
    try:
        val = fields.get(name, default)
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return int(val)
        return int(str(val))
    except (ValueError, TypeError):
        return default


# 初始化
init_db()
