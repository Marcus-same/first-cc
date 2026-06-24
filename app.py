"""SCF Web 函数入口 — 直接暴露 Flask app"""
import sys, os

# 当前目录加入 path
sys.path.insert(0, os.path.dirname(__file__))

# 导入 Flask app（recruit_server.py 中的 app 对象）
from recruit_server import app

# SCF Web 函数自动检测名为 'app' 的 Flask 实例
# 无需额外 handler，框架自动处理 HTTP → WSGI 转换
