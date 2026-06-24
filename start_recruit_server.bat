@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d D:\first-cc
echo ============================================
echo   招聘看板协作服务器
echo ============================================
echo.
python recruit_server.py %*
pause
