@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 西综学习台 - 本地服务器
echo.
echo   正在启动本地服务器（进度看板 / 学习转盘 / 讲义阅读），浏览器会自动打开...
echo.
set "PY=C:\Users\Tony\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" set "PY=python"
start "" "http://127.0.0.1:8787/"
"%PY%" serve.py 8787
pause
