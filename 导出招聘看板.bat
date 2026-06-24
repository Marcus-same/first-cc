@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d D:\first-cc
echo ============================================
echo   招聘看板 静态报告导出
echo ============================================
echo.
echo   正在从飞书 Base 拉取数据...
echo.
python export_recruit_report.py %*
echo.
pause
