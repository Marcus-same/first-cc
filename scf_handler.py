"""腾讯云 SCF 入口 — API Gateway 触发器 → Flask 应用"""
import json, os, sys
from io import BytesIO
from urllib.parse import urlencode

# 确保当前目录在 path 中
sys.path.insert(0, os.path.dirname(__file__))

# 延迟加载 Flask app（避免冷启动时重复创建）
_app = None

def get_app():
    global _app
    if _app is None:
        from recruit_server import app
        _app = app
    return _app


def main_handler(event, context):
    """SCF API Gateway 触发器入口"""
    app = get_app()

    # 解析 API Gateway 事件
    http_method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    headers = event.get("headers", {})
    query = event.get("queryString", {})
    body = event.get("body", "") or ""

    # 处理 base64 编码的 body
    if event.get("isBase64Encoded"):
        import base64
        body = base64.b64decode(body)

    # 构建 WSGI environ
    environ = {
        "REQUEST_METHOD": http_method,
        "PATH_INFO": path,
        "QUERY_STRING": urlencode(query) if isinstance(query, dict) else (query or ""),
        "SERVER_NAME": "scf",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "SCRIPT_NAME": "",
        "wsgi.version": (1, 0),
        "wsgi.url_scheme": "https",
        "wsgi.input": BytesIO(body.encode() if isinstance(body, str) else body),
        "wsgi.errors": sys.stderr,
        "wsgi.multithread": False,
        "wsgi.multiprocess": True,
        "wsgi.run_once": True,
        # CORS preflight 需要
        "HTTP_ORIGIN": headers.get("origin", headers.get("Origin", "")),
        "HTTP_ACCESS_CONTROL_REQUEST_METHOD": headers.get("access-control-request-method", ""),
        "HTTP_ACCESS_CONTROL_REQUEST_HEADERS": headers.get("access-control-request-headers", ""),
    }

    # 传递请求头
    for key, value in headers.items():
        if value is None:
            continue
        key = key.upper().replace("-", "_")
        if key not in ("CONTENT_TYPE", "CONTENT_LENGTH"):
            key = f"HTTP_{key}"
        environ[key] = str(value)

    # 处理 content-type 和 content-length
    if headers.get("Content-Type") or headers.get("content-type"):
        environ["CONTENT_TYPE"] = headers.get("Content-Type") or headers.get("content-type")
    environ["CONTENT_LENGTH"] = str(len(environ["wsgi.input"].getvalue()))

    # 调用 Flask 应用
    response_data = {
        "statusCode": 200,
        "headers": {"Content-Type": "text/html; charset=utf-8"},
        "body": "",
    }

    def start_response(status, response_headers, exc_info=None):
        status_code = int(status.split()[0])
        response_data["statusCode"] = status_code
        # 合并所有 headers
        for key, value in response_headers:
            if key.lower() == "content-type":
                response_data["headers"]["Content-Type"] = value
            else:
                response_data["headers"][key] = value
        return lambda data: response_data.setdefault("body_chunks", []).append(data)

    # 运行 WSGI 应用
    result = app(environ, start_response)

    # 收集响应体
    body_chunks = response_data.pop("body_chunks", [])
    if body_chunks:
        response_data["body"] = b"".join(body_chunks).decode("utf-8", errors="replace")
    else:
        # 有些 WSGI 应用通过返回值返回 body
        body_text = b"".join(result).decode("utf-8", errors="replace") if result else ""
        response_data["body"] = body_text

    # 添加 CORS 头
    response_data["headers"]["Access-Control-Allow-Origin"] = "*"
    response_data["headers"]["Access-Control-Allow-Methods"] = "GET, PUT, POST, DELETE, OPTIONS"

    # 清理不需要的 headers（API Gateway 会自己加）
    unwanted = {"Content-Length", "Transfer-Encoding", "Connection"}
    for key in list(response_data["headers"].keys()):
        if key.lower() in (u.lower() for u in unwanted):
            del response_data["headers"][key]

    return response_data
