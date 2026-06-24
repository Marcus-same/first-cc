#!/usr/bin/env python
"""打包 SCF 部署文件"""
import os, shutil, sys, zipfile
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

HERE = Path(__file__).parent
BUILD_DIR = HERE / "_scf_build"
OUTPUT_ZIP = HERE / "recruit_scf.zip"

# 需要打包的文件
SOURCES = [
    "app.py",
    "scf_handler.py",
    "recruit_server.py",
    "feishu_api.py",
]

# 需要一起打包的目录
DIRS = [
    "templates",
]

# Python 依赖（目录名可能与包名不同）
DEPS = [
    "flask",
    "requests",
    "urllib3",
    "certifi",
    "charset_normalizer",
    "idna",
    "dotenv",
    "blinker",
    "click",
    "itsdangerous",
    "jinja2",
    "markupsafe",
    "werkzeug",
]


def build():
    # 清理
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir()

    # 复制源文件
    for src in SOURCES:
        src_path = HERE / src
        if src_path.exists():
            shutil.copy2(src_path, BUILD_DIR / src)
            print(f"  ✅ {src}")
        else:
            print(f"  ❌ 找不到 {src}")

    # 复制模板目录
    for d in DIRS:
        src_dir = HERE / d
        if src_dir.exists():
            dst_dir = BUILD_DIR / d
            shutil.copytree(src_dir, dst_dir)
            print(f"  ✅ {d}/ ({len(list(dst_dir.rglob('*')))} files)")
        else:
            print(f"  ❌ 找不到 {d}/")

    # 复制 Python 依赖
    site_packages = Path(sys.executable).parent / "Lib" / "site-packages"
    for dep in DEPS:
        dep_path = site_packages / dep
        if dep_path.exists():
            if dep_path.is_dir():
                shutil.copytree(dep_path, BUILD_DIR / dep)
            else:
                shutil.copy2(dep_path, BUILD_DIR / dep)
            print(f"  ✅ {dep}")
        else:
            # 可能是 .py 文件
            py_path = site_packages / f"{dep}.py"
            if py_path.exists():
                shutil.copy2(py_path, BUILD_DIR / f"{dep}.py")
                print(f"  ✅ {dep}.py")
            else:
                print(f"  ⚠️  找不到 {dep}，跳过")

    # 打包 zip（排除 Windows 特定文件和缓存）
    if OUTPUT_ZIP.exists():
        OUTPUT_ZIP.unlink()

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(BUILD_DIR):
            # 排除 __pycache__ 目录
            dirs[:] = [d for d in dirs if d != "__pycache__"]
            for file in files:
                # 排除 .pyc 和 .pyd 文件
                if file.endswith(".pyc") or file.endswith(".pyd"):
                    continue
                file_path = Path(root) / file
                arcname = file_path.relative_to(BUILD_DIR)
                zf.write(file_path, arcname)

    size_mb = OUTPUT_ZIP.stat().st_size / (1024 * 1024)
    print(f"\n✅ 打包完成: {OUTPUT_ZIP} ({size_mb:.1f} MB)")

    # 清理构建目录
    shutil.rmtree(BUILD_DIR)
    print("   构建目录已清理")


if __name__ == "__main__":
    build()
