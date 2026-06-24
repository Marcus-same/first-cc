"""一键订阅公众号：python add_feed.py <文章链接>"""
import sys, json, urllib.request

AUTH = "meng2024"
API = "http://localhost:4000/trpc"

def add_feed(wxs_link):
    # 1. 获取公众号信息
    req = urllib.request.Request(
        f"{API}/platform.getMpInfo",
        data=json.dumps({"wxsLink": wxs_link}).encode(),
        headers={"Content-Type": "application/json", "Authorization": AUTH},
    )
    resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
    mp = resp["result"]["data"][0]
    print(f"📡 {mp['name']} | {mp['intro']}")

    # 2. 订阅
    req2 = urllib.request.Request(
        f"{API}/feed.add",
        data=json.dumps({
            "id": mp["id"], "mpName": mp["name"], "mpCover": mp["cover"],
            "mpIntro": mp["intro"], "updateTime": mp["updateTime"],
        }).encode(),
        headers={"Content-Type": "application/json", "Authorization": AUTH},
    )
    resp2 = json.loads(urllib.request.urlopen(req2, timeout=15).read())
    feed = resp2["result"]["data"]
    print(f"✅ 已订阅: {feed['mpName']} (status={feed['status']})")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python add_feed.py <公众号文章链接>")
        sys.exit(1)
    add_feed(sys.argv[1])
