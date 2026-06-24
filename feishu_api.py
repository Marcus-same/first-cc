"""飞书 API 直连客户端 — 替代 lark-cli，10x 速度提升"""
import json, os, time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

APP_ID = os.getenv("FEISHU_APP_ID")
APP_SECRET = os.getenv("FEISHU_APP_SECRET")
BASE_URL = "https://open.feishu.cn/open-apis"

# Token 缓存
_token_cache = {"token": None, "expires_at": 0}


def get_tenant_token() -> str:
    """获取 tenant_access_token（自动缓存，提前 5 分钟刷新）"""
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"] - 300:
        return _token_cache["token"]

    resp = requests.post(
        f"{BASE_URL}/auth/v3/tenant_access_token/internal",
        json={"app_id": APP_ID, "app_secret": APP_SECRET},
        timeout=15,
    )
    data = resp.json()
    if data.get("code") != 0:
        raise Exception(f"获取飞书 Token 失败: {data.get('msg', data)}")

    _token_cache["token"] = data["tenant_access_token"]
    _token_cache["expires_at"] = now + data.get("expire", 7200)
    return _token_cache["token"]


def _api(method: str, path: str, **kwargs) -> dict:
    """通用飞书 API 请求"""
    token = get_tenant_token()
    url = f"{BASE_URL}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }
    resp = requests.request(method, url, headers=headers, timeout=kwargs.pop("timeout", 30), **kwargs)
    data = resp.json()
    if data.get("code") != 0:
        raise Exception(f"飞书 API 错误 [{path}]: {data.get('msg', data)}")
    return data.get("data", data)


# ── Base (Bitable) 操作 ─────────────────────────────


def bitable_list_records(base_token: str, table_id: str, page_size: int = 500) -> list[dict]:
    """列出 Base 表中全部记录"""
    all_items = []
    page_token = None
    while True:
        params = {"page_size": page_size}
        if page_token:
            params["page_token"] = page_token

        data = _api("GET", f"/bitable/v1/apps/{base_token}/tables/{table_id}/records",
                    params=params, timeout=30)

        items = data.get("items", [])
        all_items.extend(items)

        if not data.get("has_more"):
            break
        page_token = data.get("page_token")

    return all_items


def bitable_upsert_record(base_token: str, table_id: str, fields: dict,
                          record_id: str = None) -> dict:
    """创建或更新记录"""
    if record_id:
        return _api("PUT",
                    f"/bitable/v1/apps/{base_token}/tables/{table_id}/records/{record_id}",
                    json={"fields": fields}, timeout=20)
    else:
        return _api("POST",
                    f"/bitable/v1/apps/{base_token}/tables/{table_id}/records",
                    json={"fields": fields}, timeout=20)


def bitable_search_records(base_token: str, table_id: str, filter_str: str,
                           page_size: int = 100) -> list[dict]:
    """按条件搜索记录（使用 Feishu filter 语法）"""
    all_items = []
    page_token = None
    params = {"page_size": page_size, "filter": filter_str}
    while True:
        if page_token:
            params["page_token"] = page_token
        data = _api("GET", f"/bitable/v1/apps/{base_token}/tables/{table_id}/records",
                    params=params, timeout=20)
        items = data.get("items", [])
        all_items.extend(items)
        if not data.get("has_more"):
            break
        page_token = data.get("page_token")
    return all_items


# ── 兼容层（与 lark-cli 返回格式一致）───────────────


def parse_bitable_record(item: dict) -> dict:
    """将飞书 API 记录格式转为 lark-cli 兼容格式"""
    record_id = item.get("record_id", "")
    fields_raw = item.get("fields", {})

    # 飞书 API 返回的字段值可能是列表或单值，与 lark-cli 格式一致
    fields = {}
    for key, val in fields_raw.items():
        if isinstance(val, list) and len(val) == 1:
            fields[key] = val[0]
        else:
            fields[key] = val

    return {"id": record_id, "fields": fields}
