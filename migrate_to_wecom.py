"""Clone Feishu Base structure + data to WeCom smart sheet."""
import subprocess
import json
import os
import re
import sys

DOCID = "dckcXIl6vbqIalnmBvpIBJgrbPe2K9btD1syTTt5K1a_orfcX-VmhYvWdXcYijvSvTLHNlXJTwMfv15oO-impWsw"
DEFAULT_SHEET_ID = "q979lj"

BASE_TOKEN = "KCXjbOD2bafH9Us4hNIcXIRWnLd"
NODE = "node"
LARK_RUN_JS = r"C:\Users\Administrator\AppData\Roaming\npm\node_modules\@larksuite\cli\scripts\run.js"
WECOM_JS = r"C:\Users\Administrator\AppData\Roaming\npm\node_modules\@wecom\cli\bin\wecom.js"

def wcmd(tool_name, params_dict):
    """Run wecom-cli doc <tool> with params as dict."""
    raw_json = json.dumps(params_dict, ensure_ascii=False)
    cmd = [NODE, WECOM_JS, "doc", tool_name, raw_json]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        return {"errcode": -1, "errmsg": result.stderr.strip()[:500]}
    try:
        rpc = json.loads(result.stdout)
        return json.loads(rpc["result"]["content"][0]["text"])
    except Exception as e:
        return {"errcode": -1, "errmsg": f"parse error: {e} | stdout: {result.stdout[:300]}"}

def lark_json(args):
    """Run lark-cli base command."""
    cmd = [NODE, LARK_RUN_JS, "base"] + args + ["--as", "user"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return json.loads(result.stdout) if result.returncode == 0 else None

def get_feishu_records(table_id):
    """Fetch all records from Feishu Base table."""
    all_records = []
    offset = 0
    fields = []
    while True:
        data = lark_json([
            "+record-list", "--base-token", BASE_TOKEN,
            "--table-id", table_id,
            "--offset", str(offset),
            "--limit", "200",
            "--format", "json",
        ])
        if not data or not data.get("ok"):
            break
        payload = data["data"]
        if not fields:
            fields = payload.get("fields", [])
        rows = payload.get("data", [])
        if not rows:
            break
        all_records.extend(rows)
        if not payload.get("has_more", False):
            break
        offset += 200
    return fields, all_records

def extract_value(cell):
    """Convert Feishu cell to plain/extracted value."""
    if cell is None:
        return ""
    if isinstance(cell, bool):
        return cell
    if isinstance(cell, list):
        if not cell:
            return ""
        # Link fields: [{id: xxx}, ...]
        if all(isinstance(x, dict) and set(x.keys()) == {"id"} for x in cell):
            return ", ".join(x["id"] for x in cell)
        # Select/attachment
        texts = []
        for item in cell:
            if isinstance(item, dict):
                texts.append(item.get("text", item.get("name", str(item))))
            else:
                texts.append(str(item))
        return texts
    if isinstance(cell, dict):
        return cell.get("text", cell.get("name", str(cell)))
    return str(cell)


# ===== Table definitions =====
TABLES = [
    ("tblseNb1pQVBMnGW", "知识库", [
        ("标题", "FIELD_TYPE_TEXT"),
        ("原始文件", "FIELD_TYPE_ATTACHMENT"),
        ("关键标签", "FIELD_TYPE_SELECT"),
        ("备注", "FIELD_TYPE_TEXT"),
        ("完整文字", "FIELD_TYPE_TEXT"),
        ("入库日期", "FIELD_TYPE_DATE_TIME"),
        ("内容摘要", "FIELD_TYPE_TEXT"),
        ("原始链接", "FIELD_TYPE_URL"),
        ("是否已整理", "FIELD_TYPE_CHECKBOX"),
        ("关联项目", "FIELD_TYPE_TEXT"),
        ("来源", "FIELD_TYPE_SINGLE_SELECT"),
    ]),
    ("tblknRrFLY3I3dmi", "会议记录", [
        ("会议名称", "FIELD_TYPE_TEXT"),
        ("会议日期", "FIELD_TYPE_DATE_TIME"),
        ("主持人", "FIELD_TYPE_SELECT"),
        ("参会人", "FIELD_TYPE_SELECT"),
        ("腾讯会议纪要", "FIELD_TYPE_TEXT"),
        ("关联项目", "FIELD_TYPE_TEXT"),
        ("会议决定", "FIELD_TYPE_TEXT"),
        ("所属模块", "FIELD_TYPE_SINGLE_SELECT"),
        ("所属项目", "FIELD_TYPE_SINGLE_SELECT"),
        ("相关实验", "FIELD_TYPE_TEXT"),
        ("腾讯会议录制文件", "FIELD_TYPE_URL"),
        ("会议类型", "FIELD_TYPE_SINGLE_SELECT"),
    ]),
    ("tblGv1QaCnVMmH1S", "项目档案", [
        ("项目名称", "FIELD_TYPE_TEXT"),
        ("阶段复盘记录", "FIELD_TYPE_TEXT"),
        ("启动日期", "FIELD_TYPE_DATE_TIME"),
        ("项目目标", "FIELD_TYPE_TEXT"),
        ("关联资料", "FIELD_TYPE_TEXT"),
        ("关联任务", "FIELD_TYPE_TEXT"),
        ("关联会议", "FIELD_TYPE_TEXT"),
        ("备注", "FIELD_TYPE_TEXT"),
        ("完成日期", "FIELD_TYPE_DATE_TIME"),
        ("项目状态", "FIELD_TYPE_SINGLE_SELECT"),
        ("负责人", "FIELD_TYPE_TEXT"),
    ]),
    ("tblRj363EurdRMqU", "探索日志", [
        ("探索人", "FIELD_TYPE_TEXT"),
        ("效果评级", "FIELD_TYPE_SINGLE_SELECT"),
        ("探索内容", "FIELD_TYPE_TEXT"),
        ("遇到的问题", "FIELD_TYPE_TEXT"),
        ("是否推荐他人使用", "FIELD_TYPE_CHECKBOX"),
        ("来源会议", "FIELD_TYPE_TEXT"),
        ("尝试日期", "FIELD_TYPE_DATE_TIME"),
    ]),
    ("tbl3jzkwFyMkv1Mx", "作品墙", [
        ("作品名称", "FIELD_TYPE_TEXT"),
        ("日期", "FIELD_TYPE_DATE_TIME"),
        ("工具/平台/方法", "FIELD_TYPE_TEXT"),
        ("使用场景", "FIELD_TYPE_SELECT"),
        ("录屏链接", "FIELD_TYPE_URL"),
        ("文档链接", "FIELD_TYPE_URL"),
        ("作者", "FIELD_TYPE_TEXT"),
        ("IT技术点评", "FIELD_TYPE_TEXT"),
        ("被复用次数", "FIELD_TYPE_NUMBER"),
    ]),
    ("tblIcMQAhhRBTceQ", "踩坑笔记", [
        ("坑点描述", "FIELD_TYPE_TEXT"),
        ("相关工具/平台/方法", "FIELD_TYPE_TEXT"),
        ("解决方案", "FIELD_TYPE_TEXT"),
        ("发现者", "FIELD_TYPE_TEXT"),
        ("日期", "FIELD_TYPE_DATE_TIME"),
        ("是否已解决", "FIELD_TYPE_CHECKBOX"),
    ]),
    ("tblQ8vHJcJghC6eE", "认知速报", [
        ("主题", "FIELD_TYPE_TEXT"),
        ("类型", "FIELD_TYPE_SINGLE_SELECT"),
        ("迁移潜力评级", "FIELD_TYPE_SINGLE_SELECT"),
        ("IT可行性评估", "FIELD_TYPE_TEXT"),
        ("相关链接", "FIELD_TYPE_URL"),
        ("日期", "FIELD_TYPE_DATE_TIME"),
    ]),
    ("tblCMp6xtdQ6ri4K", "任务看板", [
        ("任务名称", "FIELD_TYPE_TEXT"),
        ("状态", "FIELD_TYPE_SINGLE_SELECT"),
        ("优先级", "FIELD_TYPE_SINGLE_SELECT"),
        ("负责人", "FIELD_TYPE_TEXT"),
        ("IT支持人", "FIELD_TYPE_TEXT"),
        ("预计完成", "FIELD_TYPE_DATE_TIME"),
        ("实际完成", "FIELD_TYPE_DATE_TIME"),
        ("产出物", "FIELD_TYPE_ATTACHMENT"),
        ("所属项目", "FIELD_TYPE_TEXT"),
        ("备注", "FIELD_TYPE_TEXT"),
    ]),
    ("tblnn209uyEmpotd", "技术支持看板", [
        ("需求描述", "FIELD_TYPE_TEXT"),
        ("请求人", "FIELD_TYPE_TEXT"),
        ("受理IT", "FIELD_TYPE_SINGLE_SELECT"),
        ("优先级", "FIELD_TYPE_SINGLE_SELECT"),
        ("状态", "FIELD_TYPE_SINGLE_SELECT"),
        ("创建日期", "FIELD_TYPE_DATE_TIME"),
        ("解决日期", "FIELD_TYPE_DATE_TIME"),
        ("解决方案摘要", "FIELD_TYPE_TEXT"),
    ]),
    ("tbl2qcpIWfLtkG30", "工具速查", [
        ("工具名", "FIELD_TYPE_SINGLE_SELECT"),
        ("操作名", "FIELD_TYPE_TEXT"),
        ("步骤说明", "FIELD_TYPE_TEXT"),
        ("使用说明", "FIELD_TYPE_TEXT"),
        ("录入者", "FIELD_TYPE_TEXT"),
        ("最后验证日期", "FIELD_TYPE_DATE_TIME"),
    ]),
]


def setup_structure():
    """Create all sheets and fields."""
    sheet_map = {}

    # Rename default sheet
    print("Renaming default sheet -> 知识库")
    r = wcmd("smartsheet_update_sheet", {
        "docid": DOCID,
        "properties": {"sheet_id": DEFAULT_SHEET_ID, "title": "知识库"}
    })
    print(f"  {r.get('errmsg')}")

    # Get default field
    r = wcmd("smartsheet_get_fields", {"docid": DOCID, "sheet_id": DEFAULT_SHEET_ID})
    print(f"  get_fields: errcode={r.get('errcode')}")
    df = r.get("fields", [{}])[0] if r.get("fields") else {}
    df_id = df.get("field_id", "")
    df_type = df.get("field_type", "FIELD_TYPE_TEXT")
    print(f"  Default field: {df_id} ({df_type})")

    # Rename default field
    first_fn, first_ft = TABLES[0][2][0]
    r = wcmd("smartsheet_update_fields", {
        "docid": DOCID,
        "sheet_id": DEFAULT_SHEET_ID,
        "fields": [{"field_id": df_id, "field_title": first_fn, "field_type": df_type}]
    })
    print(f"  Rename to '{first_fn}': {r.get('errmsg')}")

    if first_ft != df_type:
        print(f"  NOTE: type mismatch (default {df_type}, need {first_ft})")

    # Add remaining fields for first table
    remaining = [{"field_title": n, "field_type": t} for n, t in TABLES[0][2][1:]]
    r = wcmd("smartsheet_add_fields", {
        "docid": DOCID,
        "sheet_id": DEFAULT_SHEET_ID,
        "fields": remaining
    })
    print(f"  Added {len(remaining)} fields: {r.get('errmsg')}")

    sheet_map["知识库"] = DEFAULT_SHEET_ID

    # Create remaining 9 sheets
    for table_id, table_name, fields in TABLES[1:]:
        print(f"\n  Creating: {table_name}")
        r = wcmd("smartsheet_add_sheet", {
            "docid": DOCID,
            "properties": {"title": table_name}
        })
        if r.get("errcode") != 0:
            print(f"    ERROR: {r}")
            continue
        props = r.get("properties", {})
        sheet_id = props.get("sheet_id", "")
        if not sheet_id:
            print(f"    ERROR: no sheet_id, response: {r}")
            continue
        sheet_map[table_name] = sheet_id
        print(f"    sheet_id: {sheet_id}")

        # Get/rename default field
        r = wcmd("smartsheet_get_fields", {"docid": DOCID, "sheet_id": sheet_id})
        df = r.get("fields", [{}])[0] if r.get("fields") else {}
        df_id = df.get("field_id", "")
        df_type = df.get("field_type", "FIELD_TYPE_TEXT")
        fn, ft = fields[0]
        r = wcmd("smartsheet_update_fields", {
            "docid": DOCID,
            "sheet_id": sheet_id,
            "fields": [{"field_id": df_id, "field_title": fn, "field_type": df_type}]
        })
        print(f"    Rename -> '{fn}': {r.get('errmsg')}")
        if ft != df_type:
            print(f"    NOTE: default {df_type}, need {ft}")

        # Add remaining
        remaining = [{"field_title": n, "field_type": t} for n, t in fields[1:]]
        if remaining:
            r = wcmd("smartsheet_add_fields", {
                "docid": DOCID,
                "sheet_id": sheet_id,
                "fields": remaining
            })
            print(f"    Added {len(remaining)} fields: {r.get('errmsg')}")

    return sheet_map


def format_wecom_value(val, field_type):
    """Convert a value to WeCom cell format."""
    is_empty = val is None or val == "" or (isinstance(val, list) and len(val) == 0)

    if field_type == "FIELD_TYPE_TEXT":
        if is_empty:
            return [{"type": "text", "text": ""}]
        return [{"type": "text", "text": str(val)}]

    if field_type == "FIELD_TYPE_NUMBER":
        if is_empty:
            return 0
        try:
            return float(val)
        except (ValueError, TypeError):
            return 0

    if field_type == "FIELD_TYPE_CHECKBOX":
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() in ("是", "true", "1", "yes")
        return bool(val)

    if field_type == "FIELD_TYPE_DATE_TIME":
        if is_empty:
            return ""
        s = str(val)
        if " " in s:
            return s
        if len(s) >= 10:
            return s[:10]
        return s

    if field_type == "FIELD_TYPE_URL":
        if is_empty:
            return []
        s = str(val)
        m = re.match(r'\[(.+?)\]\((.+?)\)', s)
        if m:
            return [{"type": "url", "text": m.group(1), "link": m.group(2)}]
        if s.startswith("http"):
            return [{"type": "url", "text": s, "link": s}]
        return [{"type": "url", "text": s, "link": s}]

    if field_type == "FIELD_TYPE_SELECT":
        if isinstance(val, list):
            return [{"text": str(v)} for v in val if v]
        if val:
            return [{"text": str(val)}]
        return []

    if field_type == "FIELD_TYPE_SINGLE_SELECT":
        if isinstance(val, list):
            return [{"text": str(val[0])}] if val else []
        if val:
            return [{"text": str(val)}]
        return []

    if field_type == "FIELD_TYPE_ATTACHMENT":
        return []

    return [{"type": "text", "text": str(val)}]


def import_data(sheet_map):
    """Import all records into the WeCom sheets."""
    for table_id, table_name, fields in TABLES:
        sheet_id = sheet_map.get(table_name)
        if not sheet_id:
            print(f"\n  {table_name}: SKIP (no sheet_id)")
            continue

        print(f"\n  {table_name} ({sheet_id}):")
        # Feishu returns: fields (names in order) + data (arrays in same order)
        feishu_field_names, records = get_feishu_records(table_id)
        if not records:
            print(f"    No records")
            continue

        # Build mapping: Feishu field name -> WeCom field type
        field_type_map = {f[0]: f[1] for f in fields}
        print(f"    {len(records)} records")

        # Build batches
        batch_size = 50
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            wecom_records = []
            for row in batch:
                values = {}
                for j, ffn in enumerate(feishu_field_names):
                    ft = field_type_map.get(ffn, "FIELD_TYPE_TEXT")
                    raw = extract_value(row[j] if j < len(row) else None)
                    values[ffn] = format_wecom_value(raw, ft)
                wecom_records.append({"values": values})

            r = wcmd("smartsheet_add_records", {
                "docid": DOCID,
                "sheet_id": sheet_id,
                "records": wecom_records
            })
            ec = r.get("errcode", -1)
            if ec == 0:
                print(f"      Batch {i//batch_size + 1}: {len(batch)} OK")
            else:
                err = r.get("errmsg", "")[:400]
                print(f"      Batch {i//batch_size + 1}: ERROR {ec} - {err}")
                if "parse error" in err.lower():
                    print(f"        (Skipping this table)")
                    break


def main():
    print("=" * 60)
    print("PHASE 1: Structure Setup")
    print("=" * 60)
    sheet_map = setup_structure()

    print(f"\n{'=' * 60}")
    print("Sheet map:")
    for name, sid in sheet_map.items():
        print(f"  {name}: {sid}")

    print(f"\n{'=' * 60}")
    print("PHASE 2: Data Import")
    print("=" * 60)
    import_data(sheet_map)

    print(f"\n{'=' * 60}")
    print("DONE!")
    print(f"URL: https://doc.weixin.qq.com/smartsheet/s3_AGcAxnipABcCNZiHhEwZARLSgNA18_a?scode=AHEACAdfAAwstcsEjdAGcAxnipABc")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
