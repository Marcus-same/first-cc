#!/usr/bin/env python
"""招聘看板协作服务器 — SQLite 极速版

启动: python recruit_server.py [--port 5000] [--no-tunnel]
数据存储在 recruit_data.db (SQLite)，读写 < 1ms。
首次启动自动从飞书 Base 迁移历史数据。
"""
import json, os, re, sys, time
from datetime import datetime

if sys.platform == 'win32':
    import io
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass
from pathlib import Path

import db
from flask import Flask, request, jsonify, render_template, redirect

app = Flask(__name__, template_folder="templates")

# ── CORS ────────────────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        r = app.make_default_options_response()
        r.headers.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })
        return r

# ── API: Funnel ─────────────────────────────────────────

@app.route('/api/v1/funnel', methods=['GET', 'PUT'])
def api_funnel():
    date = (request.args.get("date") if request.method == 'GET' else request.json.get("date")) or ""
    if not date:
        return jsonify({"ok": False, "error": "缺少 date 参数"}), 400
    if request.method == 'GET':
        return jsonify({"ok": True, "date": date, "funnel": db.funnel_get(date)})
    body = request.json
    for dept, data in body.get("funnel", {}).items():
        db.funnel_upsert(date, dept, data, body.get("editor", "匿名"))
    return jsonify({"ok": True, "date": date})

# ── API: Progress ───────────────────────────────────────

@app.route('/api/v1/progress', methods=['GET', 'PUT'])
def api_progress():
    date = (request.args.get("date") if request.method == 'GET' else request.json.get("date")) or ""
    if not date:
        return jsonify({"ok": False, "error": "缺少 date 参数"}), 400
    if request.method == 'GET':
        return jsonify({"ok": True, "date": date, "progress": db.progress_get(date)})
    body = request.json
    for dept, items in body.get("progress", {}).items():
        db.progress_upsert(date, dept, items, body.get("editor", "匿名"))
    return jsonify({"ok": True, "date": date})

# ── API: Notes ──────────────────────────────────────────

@app.route('/api/v1/notes', methods=['GET', 'PUT'])
def api_notes():
    date = (request.args.get("date") if request.method == 'GET' else request.json.get("date")) or ""
    if not date:
        return jsonify({"ok": False, "error": "缺少 date 参数"}), 400
    if request.method == 'GET':
        n = db.notes_get(date)
        return jsonify({"ok": True, "date": date, "notes": n["content"],
                        "fontColor": n["fontColor"], "bgColor": n["bgColor"]})
    body = request.json
    db.notes_upsert(date, body.get("notes", ""),
                    body.get("fontColor", "#111111"), body.get("bgColor", "#ffffff"),
                    body.get("editor", "匿名"))
    return jsonify({"ok": True, "date": date})

# ── API: Multi-get ──────────────────────────────────────

@app.route('/api/v1/day', methods=['GET'])
def api_day():
    date = request.args.get("date", "")
    if not date:
        return jsonify({"ok": False, "error": "缺少 date 参数"}), 400
    funnel = db.funnel_get(date)
    progress = db.progress_get(date)
    n = db.notes_get(date)
    return jsonify({"ok": True, "date": date, "funnel": funnel,
                    "progress": progress, "notes": n["content"],
                    "fontColor": n["fontColor"], "bgColor": n["bgColor"]})

# ── API: Health ─────────────────────────────────────────

@app.route('/api/health')
def api_health():
    return jsonify({"ok": True, "storage": "sqlite", "db": str(db.DB_PATH)})

# ── API: Export ─────────────────────────────────────────

@app.route('/api/export', methods=['GET'])
def api_export():
    data = db.export_all()
    return jsonify({"ok": True, "data": data, "count": len(data)})

# ── API: Camp (v2) ──────────────────────────────────────

@app.route('/api/v2/entries', methods=['GET'])
def api_v2_entries():
    return jsonify({"ok": True, "entries": db.camp_get_all()})

@app.route('/api/v2/entry', methods=['GET', 'PUT'])
def api_v2_entry():
    date = (request.args.get("date") if request.method == 'GET' else request.json.get("date")) or ""
    if not date:
        return jsonify({"ok": False, "error": "缺少 date 参数"}), 400
    if request.method == 'GET':
        entries = [e for e in db.camp_get_all() if e.get("date") == date]
        return jsonify({"ok": True, "entry": entries[0] if entries else {"date": date}})
    body = request.json
    db.camp_upsert(date, body.get("entry", {}), body.get("editor", "匿名"))
    return jsonify({"ok": True, "date": date})

# ── Pages ───────────────────────────────────────────────

@app.route('/')
def index():
    return redirect('/dashboard1')

@app.route('/dashboard1')
def dashboard1():
    return render_template('dashboard1.html')

@app.route('/dashboard2')
def dashboard2():
    return render_template('dashboard2.html')

@app.route('/migrate')
def migrate_page():
    return render_template('migrate.html')

# ── Tunneling ───────────────────────────────────────────

def start_tunnels(port: int):
    public_url = None
    CLDFLARED = Path(__file__).parent.parent / "projects" / "blog-monitor" / "cloudflared.exe"

    print("\n🚀 启动 serveo.net 隧道...")
    try:
        import subprocess as sp
        sv = sp.Popen(
            ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ServerAliveInterval=60",
             "-o", "ExitOnForwardFailure=yes",
             "-R", f"meng-recruit:80:localhost:{port}", "serveo.net"],
            stdout=sp.PIPE, stderr=sp.STDOUT, text=True, encoding="utf-8", errors="replace",
            creationflags=sp.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        deadline = time.time() + 15
        while time.time() < deadline:
            line = sv.stdout.readline()
            if not line:
                if sv.poll() is not None: break
                time.sleep(0.3); continue
            m = re.search(r'Forwarding HTTP traffic from (https://\S+)', line)
            if m:
                public_url = m.group(1)
                print(f"   ✅ {public_url}", flush=True)
                break
        if sv.poll() is not None and not public_url:
            print(f"   ❌ serveo 连接失败")
    except Exception as e:
        print(f"   ⚠️ serveo.net: {e}")

    if not public_url and CLDFLARED.exists():
        print("\n🚀 Cloudflare Tunnel...")
        try:
            import subprocess as sp
            cf = sp.Popen(
                [str(CLDFLARED), "tunnel", "--url", f"http://localhost:{port}", "--no-autoupdate"],
                stdout=sp.PIPE, stderr=sp.STDOUT, text=True, encoding="utf-8", errors="replace",
                creationflags=sp.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
            deadline = time.time() + 30
            while time.time() < deadline:
                line = cf.stdout.readline()
                if not line: time.sleep(0.5); continue
                m = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                if m:
                    public_url = m.group(0)
                    print(f"   ✅ {public_url}", flush=True)
                    break
        except Exception as e:
            print(f"   ⚠️ Cloudflare: {e}")
    return public_url

# ── Main ────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="招聘看板协作服务器")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--no-tunnel", action="store_true")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    print("=" * 50)
    print("📋 招聘看板协作服务器（SQLite 极速版）")
    print(f"   数据库: {db.DB_PATH}")
    print("=" * 50)

    # 自动从飞书 Base 迁移数据
    db.auto_migrate()

    # Tunnel
    public_url = None
    if not args.no_tunnel:
        public_url = start_tunnels(args.port)

    url_file = Path(__file__).parent / ".recruit_url.txt"
    if public_url:
        url_file.write_text(public_url, encoding="utf-8")
        print(f"\n{'=' * 50}")
        print(f"🌐 {public_url}")
        print(f"   同事打开即可使用")
        print(f"★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★")
        print(f"  公网地址: {public_url}")
        print(f"★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★")
    else:
        url_file.write_text(f"http://localhost:{args.port}", encoding="utf-8")
        print(f"\n🌐 本地: http://localhost:{args.port}")
    print(f"{'=' * 50}")

    app.run(host="0.0.0.0", port=args.port, debug=args.debug, use_reloader=False)

if __name__ == "__main__":
    main()
