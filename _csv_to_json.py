"""把多段 CSV 转成结构化 JSON"""
import json

PATH = r"d:\下载\招聘数据_2026-06-22 (1).csv"
OUT = r"d:\下载\招聘数据_2026-06-22.json"

with open(PATH, "r", encoding="utf-8-sig") as f:
    raw = f.read()

lines = [l.strip() for l in raw.split("\n")]

result = {"日期": lines[0].split(",")[1], "部门数据": [], "累计进度": [], "备注": []}

# 定位各段起止行
section_starts = {}
for idx, line in enumerate(lines):
    if line == "部门数据":
        section_starts["部门数据"] = idx
    elif line == "累计进度":
        section_starts["累计进度"] = idx
    elif line == "备注":
        section_starts["备注_start"] = idx

# 解析"部门数据"
if "部门数据" in section_starts:
    s = section_starts["部门数据"]
    headers = [h.strip() for h in lines[s + 1].split(",")]
    for line in lines[s + 2 :]:
        if not line:
            break
        vals = [v.strip() for v in line.split(",")]
        result["部门数据"].append(dict(zip(headers, vals)))

# 解析"累计进度"
if "累计进度" in section_starts:
    s = section_starts["累计进度"]
    headers = [h.strip() for h in lines[s + 1].split(",")]
    for line in lines[s + 2 :]:
        if not line:
            break
        vals = [v.strip() for v in line.split(",")]
        result["累计进度"].append(dict(zip(headers, vals)))

# 解析"备注"
if "备注_start" in section_starts:
    s = section_starts["备注_start"]
    for line in lines[s + 1 :]:
        if line:
            result["备注"].append(line)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"已保存: {OUT}")
print(f"  日期: {result['日期']}")
print(f"  部门数据: {len(result['部门数据'])} 行")
print(f"  累计进度: {len(result['累计进度'])} 行")
print(f"  备注: {len(result['备注'])} 条")
