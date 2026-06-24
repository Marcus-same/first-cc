"""
妙记自动捕获 — 轮询飞书账号下新妙记，推送到 Bridge 群

用法:
  python minutes_watcher.py              # 单次检查
  python minutes_watcher.py --daemon     # 持续轮询（默认 300s）
  python minutes_watcher.py --daemon --interval 120  # 自定义间隔
"""

import argparse, json, os, re, subprocess, sys, time
from datetime import datetime, date
from pathlib import Path

# === 配置 ===
CHAT_ID = "oc_f2ae3639d64ccd8bb8684c384ec22429"
BOT_ID = "cli_a97424c76f3a1cbd"
SCRIPT_DIR = Path(__file__).parent
STATE_FILE = SCRIPT_DIR / ".minutes_seen"

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def _lark(*args: str) -> dict:
    """调用 lark-cli (Windows: 走 workbuddy node + run.js)"""
    import platform
    system = platform.system()
    if system == "Windows":
        # 优先用 workbuddy 自带的 node 和 lark-cli
        home = os.path.expanduser("~")
        candidates = [
            # workbuddy 内置
            (os.path.join(home, ".workbuddy", "binaries", "node", "versions", "22.22.2", "node.exe"),
             os.path.join(home, ".workbuddy", "binaries", "node", "cli-connector-packages", "node_modules", "@larksuite", "cli", "scripts", "run.js")),
            # npm 全局安装
            (os.path.join(home, "AppData", "Roaming", "npm", "node.exe"),
             os.path.join(home, "AppData", "Roaming", "npm", "node_modules", "@larksuite", "cli", "scripts", "run.js")),
        ]
        found = False
        for node_exe, run_js in candidates:
            if os.path.exists(run_js):
                node = node_exe if os.path.exists(node_exe) else "node"
                cmd = [node, run_js] + list(args)
                found = True
                break
        if not found:
            return {"ok": False, "error": "lark-cli not found"}
    else:
        cmd = ["lark-cli"] + list(args)

    for attempt in range(2):
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=30)
            for enc in ('utf-8', 'gbk', 'cp936'):
                try:
                    out = result.stdout.decode(enc).strip()
                    if out:
                        return json.loads(out)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
            for enc in ('utf-8', 'gbk', 'cp936'):
                try:
                    out = result.stderr.decode(enc).strip()
                    if out:
                        return json.loads(out)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            if attempt >= 1:
                return {"ok": False, "error": str(e)}
        if attempt < 1:
            time.sleep(1)
    return {"ok": False, "error": "lark-cli failed"}


def load_seen_tokens() -> set:
    """读取已处理的 minute_token 集合"""
    if STATE_FILE.exists():
        try:
            data = json.loads(STATE_FILE.read_text("utf-8"))
            if isinstance(data, list):
                return set(data)
        except (json.JSONDecodeError, ValueError):
            pass
    return set()


def save_seen_tokens(tokens: set):
    """保存已处理的 minute_token 集合"""
    STATE_FILE.write_text(json.dumps(sorted(tokens), ensure_ascii=False), "utf-8")


def search_today_minutes() -> list[dict]:
    """搜索今日妙记"""
    today = date.today().isoformat()
    resp = _lark("--as", "user", "minutes", "+search",
                 "--owner-ids", "me",
                 "--start", today,
                 "--end", today,
                 "--page-size", "30")
    if not resp.get("ok"):
        error_msg = resp.get("error", "unknown")
        print(f"  ⚠️ 搜索妙记失败: {error_msg}")
        return []
    return resp.get("data", {}).get("items", [])


def extract_minute_token(item: dict) -> str | None:
    """从搜索结果条目提取 minute_token"""
    return item.get("token") or item.get("minute_token")


def send_bridge_notification(text: str):
    """发通知到 Bridge 群"""
    resp = _lark("im", "+messages-send", "--as", "bot",
                 "--chat-id", CHAT_ID, "--msg-type", "text",
                 "--text", text)
    if not resp.get("ok"):
        print(f"  ⚠️ 发送通知失败: {resp.get('error', resp)}")


def run_once():
    """单次检查"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 检查今日妙记...")
    items = search_today_minutes()

    if not items:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 今日无妙记")
        return

    seen = load_seen_tokens()
    new_count = 0

    for item in items:
        token = extract_minute_token(item)
        if not token:
            continue
        if token in seen:
            continue

        title = item.get("title") or item.get("display_info", "").split("\n")[0] or "未命名妙记"
        url = item.get("url") or (item.get("meta_data") or {}).get("app_link", "")
        print(f"  新妙记: {title}")

        # 通知 Bridge 群
        send_bridge_notification(f"📋 新妙记待处理：{title}\n{url}")

        seen.add(token)
        new_count += 1

    if new_count:
        save_seen_tokens(seen)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 发现 {new_count} 条新妙记")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 无新妙记 ({len(items)} 条今日)")


def run_daemon(interval: int):
    """持续轮询"""
    print(f"妙记监控已启动 (间隔 {interval}s, Bridge: {CHAT_ID})")
    print("按 Ctrl+C 退出")
    while True:
        try:
            run_once()
        except KeyboardInterrupt:
            print("\n已退出")
            break
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 异常: {e}")
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="飞书妙记自动捕获")
    parser.add_argument("--daemon", action="store_true", help="持续轮询")
    parser.add_argument("--interval", type=int, default=300, help="轮询间隔秒 (默认300)")
    args = parser.parse_args()

    if args.daemon:
        run_daemon(args.interval)
    else:
        run_once()


if __name__ == "__main__":
    main()
