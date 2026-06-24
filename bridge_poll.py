"""
飞书桥接轮询脚本 — 独立运行，不依赖 Claude Code
自动检查 Bridge 群新消息，提取链接调 ingest_hr.py 入库，回复结果

用法:
  python bridge_poll.py              # 单次检查
  python bridge_poll.py --daemon     # 持续轮询（默认 60s）

首次运行前确保 .bridge_last_msg 已初始化：
  echo om_x00000000000000000000000000000000 > D:/first-cc/.bridge_last_msg
"""

import argparse, json, os, re, subprocess, sys, time
from datetime import datetime
from pathlib import Path

# === 配置 ===
CHAT_ID = "oc_f2ae3639d64ccd8bb8684c384ec22429"
BOT_ID = "cli_a97424c76f3a1cbd"
SCRIPT_DIR = Path(__file__).parent
STATE_FILE = SCRIPT_DIR / ".bridge_last_msg"

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def _lark(*args: str) -> dict:
    """调用 lark-cli (Windows 用 cmd /c 包装，避免 shell 转义问题)"""
    result = subprocess.run(
        ["cmd", "/c", "lark-cli"] + list(args),
        capture_output=True, text=True, timeout=30,
        cwd=str(SCRIPT_DIR), encoding='utf-8', errors='replace'
    )
    try:
        return json.loads(result.stdout) if result.stdout else {"ok": False, "error": "empty output"}
    except json.JSONDecodeError:
        return {"ok": False, "error": result.stderr or result.stdout}


def poll_messages() -> list[dict]:
    """拉取群消息"""
    resp = _lark("im", "+chat-messages-list", "--as", "user",
                  "--chat-id", CHAT_ID)
    if not resp.get("ok"):
        print(f"  ⚠️ 拉取消息失败: {resp.get('error', resp)}")
        return []
    return resp.get("data", {}).get("messages", [])


def get_last_processed_position() -> int:
    """读取上次处理到的消息位置"""
    if STATE_FILE.exists():
        try:
            return int(STATE_FILE.read_text("utf-8").strip())
        except ValueError:
            return 0
    return 0


def set_last_processed_position(pos: int):
    """记录最新已处理消息位置"""
    STATE_FILE.write_text(str(pos) + "\n", "utf-8")


def extract_urls(text: str) -> list[str]:
    """从消息中提取可入库链接"""
    urls = []
    for m in re.finditer(r'https?://v\.douyin\.com/[^\s]+', text):
        urls.append(m.group().rstrip(".,;!?)]"))
    for m in re.finditer(r'https?://xhslink\.com/[^\s]+', text):
        urls.append(m.group().rstrip(".,;!?)]"))
    return urls


def send_reply(text: str):
    """发消息到桥接群"""
    # 单行发送，避免换行在 cmd 传参中出问题
    # 多行内容用 "\n" 字面量在飞书端渲染
    resp = _lark("im", "+messages-send", "--as", "bot",
                 "--chat-id", CHAT_ID, "--msg-type", "text",
                 "--text", text)
    if not resp.get("ok"):
        print(f"  ⚠️ 回复失败: {resp.get('error', resp)}")


def process_message(msg: dict) -> bool:
    """处理单条用户消息"""
    content = msg.get("content", "")
    sender = msg.get("sender", {})

    # 只处理用户消息
    if sender.get("sender_type") != "user":
        return True

    # 只处理有"入库"标记的消息
    if "入库" not in content:
        return True

    urls = extract_urls(content)
    if not urls:
        send_reply("看到你发了消息但没找到可入库的链接。发一个链接 + 入库 就行。")
        return True

    url_display = urls[0]
    if len(url_display) > 60:
        url_display = url_display[:60] + "..."
    print(f"  [{datetime.now().strftime('%H:%M:%S')}] 处理: {url_display}")

    send_reply("收到，正在处理...")

    all_ok = True
    for url in urls:
        try:
            result = subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "ingest_hr.py"),
                 "--url", url, "--yes"],
                capture_output=True, text=True, timeout=300,
                cwd=str(SCRIPT_DIR), encoding='utf-8', errors='replace'
            )
            if result.returncode == 0:
                title = ""
                for line in result.stdout.splitlines():
                    if "已入库:" in line:
                        title = line.split("已入库:", 1)[-1].strip()
                        # 去掉 record id
                        if "(record:" in title:
                            title = title.split("(record:")[0].strip()
                        break
                tag_match = re.search(r'🏷️\s+(.+)', result.stdout)
                tags = tag_match.group(1).strip() if tag_match else ""
                reply = f"已入库！{title}"
                if tags:
                    reply += f"\n🏷️ {tags}"
                reply += "\n📎 https://bytedance.feishu.cn/base/TpoSbBr6QaXUDFs4abYcEJQEnUd?table=tblac5PrdBNBj8Nn"
                send_reply(reply)
            else:
                err = result.stderr[:200] if result.stderr else "未知错误"
                send_reply(f"入库失败：{url_display}\n{err}")
                all_ok = False
        except subprocess.TimeoutExpired:
            send_reply(f"入库超时：{url_display}（可能视频较长，请稍后重试）")
            all_ok = False
        except Exception as e:
            send_reply(f"入库异常：{url_display}\n{str(e)[:200]}")
            all_ok = False

    return all_ok


def run_once():
    """单次轮询"""
    messages = poll_messages()
    if not messages:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 无消息或拉取失败")
        return

    last_pos = get_last_processed_position()

    # messages 按时间倒序（最新在前），需要正序处理
    messages.reverse()

    new_count = 0
    for msg in messages:
        pos_str = msg.get("message_position", "0")
        try:
            pos = int(pos_str)
        except ValueError:
            pos = 0

        if pos <= last_pos:
            continue

        sender = msg.get("sender", {})
        # 自己的 bot 消息只更新位置占位，不处理
        if sender.get("id") == BOT_ID:
            set_last_processed_position(pos)
            continue

        process_message(msg)
        set_last_processed_position(pos)
        new_count += 1

    if new_count:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 处理了 {new_count} 条新消息")
    else:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 无新消息 (last_pos={last_pos})")


def run_daemon(interval: int):
    """持续轮询"""
    print(f"桥接轮询已启动 (间隔 {interval}s)")
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
    parser = argparse.ArgumentParser(description="飞书桥接轮询")
    parser.add_argument("--daemon", action="store_true", help="持续轮询")
    parser.add_argument("--interval", type=int, default=60, help="轮询间隔秒 (默认60)")
    args = parser.parse_args()

    if args.daemon:
        run_daemon(args.interval)
    else:
        run_once()


if __name__ == "__main__":
    main()
